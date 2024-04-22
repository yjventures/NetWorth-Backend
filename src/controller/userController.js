const ErrorHandler = require("../utils/errorHandler");
const { catchAsync } = require("../middleware/catchAsyncError");
const userModel = require("../model/userModel");
const personalInfoModel = require("../model/personalInfoModel");
const userBcrypt = require("../utils/userBcrypt");
const SendEmailUtils = require("../utils/SendEmailUtils");
const otpGenerator = require("otp-generator");
const OTPModel = require("../model/OTPModel");
const fcmModel = require("../model/fcmModel")
const {
  AzureKeyCredential,
  DocumentAnalysisClient,
} = require("@azure/ai-form-recognizer");
const jwt = require("jsonwebtoken");
const verifyRefreshToken = require("../utils/verifyRefreshToken");
const cardModel = require("../model/cardModel");

const regex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@.#$!%*?&])[A-Za-z\d@.#$!%*?&]{8,15}$/;

exports.userRegistration = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;

  //validation checks
  if (!name || !email || !password) {
    return next(new ErrorHandler(400, "All Fields Are Required"));
  }
  //password regex check
  if (!regex.test(password)) {
    return next(
      new ErrorHandler(
        400,
        "Invalid password format. Password must have at least one lowercase letter, one uppercase letter, one digit, one special character, and be 8-15 characters long."
      )
    );
  }
  //check user in db
  const user = await userModel.findOne({ email: email });

  //if user exist
  if (user) {
    return next(new ErrorHandler(400, "User Already Exists"));
  }

  //hashed the password
  const hashedPassword = await userBcrypt.hashPassword(password);

  //create personal info
  const personalInfo = await personalInfoModel.create({
    name: name,
  });

  //catch the new created personalinfo id
  const personalInfoId = personalInfo._id;

  //create new user
  const newUser = await userModel.create({
    email: email,
    password: hashedPassword,
    role: "user",
    personal_info: personalInfoId,
  });

  //4 digit otp generate
  const OTPCode = otpGenerator.generate(4, {
    digits: true,
    alphabets: false,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  const userCount = await userModel.aggregate([
    { $match: { email: email } },
    { $count: "total" },
  ]);

  if (userCount.length > 0) {
    // Insert OTP into the database
    await OTPModel.create({ email: email, otp: OTPCode });

    // Send email with OTP
    const emailMessage = `Your Verification Pin Code is: ${OTPCode}`;
    const emailSubject = "NetWorth";
    const emailSend = await SendEmailUtils(email, emailMessage, emailSubject);

    newUser.password = undefined;

    return res.status(201).json({
      status: true,
      message: "Check Your Mail For Verification OTP",
      data: newUser,
    });
  } else {
    return next(new ErrorHandler(400, "User not Found"));
  }
});

exports.verifyRegistrationOTP = catchAsync(async (req, res, next) => {
  const { email, otp } = req.body;
  const user = await userModel.findOne({ email });

  if (!user) {
    return next(new ErrorHandler(404, "User not found"));
  }

  // Check if OTP exists and is not expired
  const OTPStatus = 0; // Status 0 indicates the OTP is not yet verified
  const OTPCount = await OTPModel.countDocuments({
    email,
    otp,
    status: OTPStatus,
  });

  if (OTPCount === 0) {
    return next(new ErrorHandler(400, "Invalid OTP"));
  }

  // Update OTP status to indicate verification
  await OTPModel.updateOne({ email, otp, status: OTPStatus }, { status: 1 });

  user.is_verified = true;
  user.save();

  return res.status(200).json({
    status: true,
    message: "OTP Verified Successfully",
  });
});

//for image to text
exports.analyzeDocument = catchAsync(async (req, res, next) => {
  const { imageUrl } = req.body;
  const key = process.env.AZURE_KEY;
  const endpoint = process.env.ENDPOINT;

  // Create Azure Form Recognizer client
  const client = new DocumentAnalysisClient(
    endpoint,
    new AzureKeyCredential(key)
  );

  // Begin document analysis
  const poller = await client.beginAnalyzeDocument(
    "prebuilt-document",
    imageUrl
  );
  const { pages } = await poller.pollUntilDone();

  if (
    !pages ||
    pages.length === 0 ||
    !pages[0].lines ||
    pages[0].lines.length === 0
  ) {
    return next(
      new ErrorHandler(400, "No lines were extracted from the document.")
    );
  }

  // Extract lines from the analyzed document
  const lines = pages[0].lines.map((line) => line.content);

  //   console.log("Extracted lines:", lines);

  // Respond with the extracted lines and the original image URL
  return res.status(200).json({
    status: true,
    data: {
      form_text: lines,
      image: imageUrl,
    },
  });
});

//user login
exports.login = catchAsync(async (req, res, next) => {
  const { email, password, fcmToken } = req.body;

  const user = await userModel.findOne({ email }).select("+password");

  if (!user) {
    return next(new ErrorHandler(400, "User Not Exists"));
  }

  const match = await userBcrypt.comparePassword(password, user.password);
  if (!match) {
    return next(new ErrorHandler(400, "Password Is incorrect"));
  }

  // const OTPCode = otpGenerator.generate(4, {
  //   digits: true,
  //   alphabets: false,
  //   lowerCaseAlphabets: false,
  //   upperCaseAlphabets: false,
  //   specialChars: false,
  // });

  // const userCount = await userModel.aggregate([
  //   { $match: { email: email } },
  //   { $count: "total" },
  // ]);

  // if (userCount.length > 0) {
  //   // Insert OTP into the database
  //   await OTPModel.create({ email: email, otp: OTPCode });

  //   // Send email with OTP
  //   const emailMessage = `Your Pin Code is: ${OTPCode}`;
  //   const emailSubject = "NetWorth";
  //   const emailSend = await SendEmailUtils(email, emailMessage, emailSubject);

  const fcmExists = await fcmModel.findOne({
    user_id: user?._id,
    fcm_token: fcmToken,
  });

  if (!fcmExists) {
    const fcm = await fcmModel.create({
      user_id: user?._id,
      fcm_token: fcmToken,
    });
    console.log("New FCM token created:", fcm);
  } else {
    fcmExists.updatedAt = new Date();
    await fcmExists.save();
  }


  const accessToken = jwt.sign(
    {
      userId: user?._id,
      role: user?.role,
      email: user?.email,
    },
    process.env.SECRET_KEY,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    { userId: user?._id },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    }
  );

  user.password = undefined;
  res.status(200).json({
    status: true,
    message: "login successful",
    data: user,
    accessToken: accessToken,
    refreshToken: refreshToken,
  });
});

//verify login
exports.verifyLoginOTP = catchAsync(async (req, res, next) => {
  const { email, otp } = req.body;
  // console.log(req.body)

  // Check if user with the given email exists
  const user = await userModel
    .findOne({ email })
    .populate({ path: "personal_info", select: "bio" })
    .select("-password");

  // console.log(user)

  if (!user) {
    return next(new ErrorHandler(400, "User not Exists"));
  }

  let status = 0;

  // First OTP count
  let OTPCount = await OTPModel.aggregate([
    { $match: { email: email, otp: otp, status: status } },
    { $count: "total" },
  ]);

  if (OTPCount.length > 0) {
    let otpUpdate = await OTPModel.updateOne(
      { email: email, otp: otp, status: status },
      {
        email: email,
        otp: otp,
        status: 1,
      }
    );

    // Generate JWT token
    // console.log(user?.email)
    // console.log(user)
    const accessToken = jwt.sign(
      {
        userId: user?._id,
        role: user?.role,
        email: user?.email,
      },
      process.env.SECRET_KEY,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { userId: user?._id },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
      }
    );

    user.password = undefined;

    res.status(200).json({
      success: true,
      message: "User logged in successfully",
      data: user,
      accessToken: accessToken,
      refreshToken: refreshToken,
    });
  } else {
    res.status(200).json({ status: false, message: "Invalid OTP Code" });
  }
});

exports.generateAccessToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;

  // Verify the refresh token and get userId
  const verificationResult = await verifyRefreshToken.verifyRefresh(
    refreshToken
  );
  // console.log(verificationResult);

  if (!verificationResult.valid) {
    return next(new ErrorHandler(401, "Invalid token, try logging in again"));
  }

  const { userId } = verificationResult;
  // console.log("User ID:", userId);

  // Find the user based on userId
  const user = await userModel.findById(userId);
  // console.log("User:", user);

  if (!user) {
    return next(new ErrorHandler(400, "User not found"));
  }

  // Generate a new access token
  const accessToken = jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.SECRET_KEY,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  return res.status(200).json({ success: true, accessToken });
});

//update personal info
exports.updatePersonalInfo = catchAsync(async (req, res, next) => {
  const userId = req.headers.userId;
  const reqBody = req.body;
  //   console.log(reqBody)

  // Check if the user exists
  const user = await userModel.findById(userId);
  if (!user) {
    return next(new ErrorHandler(400, "You Are Not Authorized"));
  }

  const personalInfoId = user?.personal_info;

  // Find and update the personal information
  const updatedPersonalInfo = await personalInfoModel.findByIdAndUpdate(
    personalInfoId,
    reqBody,
    { new: true, runValidators: true }
  );

  if (!updatedPersonalInfo) {
    return next(new ErrorHandler(404, "Personal information not found"));
  }

  //Optionally, update user's personal_info reference
  user.is_completed_personal_info = true;
  await user.save();

  return res.status(200).json({
    status: true,
    message: "Personal information updated successfully",
    data: updatedPersonalInfo,
  });
});

//get personal info
exports.getPersonalInfo = catchAsync(async (req, res, next) => {
  const userId = req.headers.userId;
  const user = await userModel.findById(userId).populate("personal_info");

  // Check if user exists
  if (!user) {
    return next(new ErrorHandler(404, "User not found"));
  }

  // Check if user.cards exists and is not empty before populating
  // if (user.cards && user.cards.length > 0) {
  //   await user.populate("cards").execPopulate();
  // }

  return res
    .status(200)
    .json({ success: true, data: { user, cardLength: user.cards.length } });
});

//forget password related controller
exports.RecoverVerifyEmail = catchAsync(async (req, res) => {
  const email = req.params.email;

  // OTP code generation
  const OTPCode = otpGenerator.generate(4, {
    digits: true,
    alphabets: false,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  // Check if the user exists
  const userCount = await userModel.aggregate([
    { $match: { email: email } },
    { $count: "total" },
  ]);

  if (userCount.length > 0) {
    // Insert OTP into the database
    await OTPModel.create({ email: email, otp: OTPCode });

    // Send email with OTP
    const emailMessage = `Your Pin Code is: ${OTPCode}`;
    const emailSubject = "RFQ Verification System";
    const emailSend = await SendEmailUtils(email, emailMessage, emailSubject);

    res.status(200).json({ status: true, data: emailSend });
  } else {
    return next(new ErrorHandler(404, "User Not Found"));
  }
});

exports.recoverOTPVerify = catchAsync(async (req, res) => {
  //find email and otp from the parameter
  let email = req.params.email;
  let OTPCode = req.params.otp;
  let status = 0;

  //first otp count
  let OTPCount = await OTPModel.aggregate([
    { $match: { email: email, otp: OTPCode, status: status } },
    { $count: "total" },
  ]);
  if (OTPCount.length > 0) {
    let otpUpdate = await OTPModel.updateOne(
      { email: email, otp: OTPCode, status: status },
      {
        email: email,
        otp: OTPCode,
        status: 1,
      }
    );
    res.status(200).json({ status: true, data: otpUpdate });
  } else {
    return next(new ErrorHandler(402, "Invalid OTP Code"));
  }
});

exports.RecoverResetPassword = catchAsync(async (req, res) => {
  let email = req.body["email"];
  let OTPCode = req.body["OTP"];
  let newPassword = req.body["password"];

  let status = 1;

  let OTPUsedCount = await OTPModel.aggregate([
    { $match: { email: email, otp: OTPCode, status: status } },
    { $count: "total" },
  ]);

  if (OTPUsedCount.length > 0) {
    let password = newPassword;

    if (!regex.test(password)) {
      return res.status(400).json({
        status: "fail",
        message:
          "Invalid password format. Password must have at least one lowercase letter, one uppercase letter, one digit, one special character, and be 8-15 characters long.",
      });
    }

    const hashedPassword = await userBcrypt.hashPassword(password);
    let passwordUpdate = await userModel.updateOne(
      { email: email },
      {
        password: hashedPassword,
      }
    );
    res.status(200).json({
      status: true,
      message: "",
      data: passwordUpdate,
    });
  } else {
    return next(new ErrorHandler(402, "OTP Code is not valid"));
  }
});

exports.changePassword = catchAsync(async (req, res, next) => {
  const userId = req.headers.userId;
  const { old_password, new_password} = req.body;
  const user = await userModel.findById(userId);
  if (!user) {
    return next(new ErrorHandler(400, "You Are Not Authorized"));
  }

  //match old password
  const match = await userBcrypt.comparePassword(old_password, user.password);

  // console.log(match)
  if (!match) {
    return next(new ErrorHandler(400, "Old password is incorrect"));
  }

  //hash new password
  if (!regex.test(new_password)) {
    return next(
      new ErrorHandler(
        400,
        "Invalid password format. Password must have at least one lowercase letter, one uppercase letter, one digit, one special character, and be 8-15 characters long."
      )
    );
  }
  //hashed the password
  const hashedPassword = await userBcrypt.hashPassword(new_password);
  const passwordUpdate = await userModel.findByIdAndUpdate(
    userId,
    { password: hashedPassword },
    { new: true, runValidators: true }
  );

  if (!passwordUpdate) {
    return next(new ErrorHandler(404, "Password not updated"));
  }

  return res.status(200).json({
    status: true,
    message: "Password updated successfully",
    // data: passwordUpdate,
  });
})

