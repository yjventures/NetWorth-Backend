const ErrorHandler = require("../utils/errorHandler");
const { catchAsync } = require("../middleware/catchAsyncError");
const userModel = require("../model/userModel");
const personalInfoModel = require("../model/personalInfoModel");
const userBcrypt = require("../utils/userBcrypt");
const SendEmailUtils = require("../utils/SendEmailUtils");
const otpGenerator = require("otp-generator");
const OTPModel = require("../model/OTPModel");
const {
  AzureKeyCredential,
  DocumentAnalysisClient,
} = require("@azure/ai-form-recognizer");
const jwt = require("jsonwebtoken");
const verifyRefreshToken = require("../utils/verifyRefreshToken");

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
  const { email, password } = req.body;

  const user = await userModel.findOne({ email }).select("+password");

  if (!user) {
    return next(new ErrorHandler(400, "User Already Exists"));
  }

  const match = await userBcrypt.comparePassword(password, user.password);
  if (!match) {
    return next(new ErrorHandler(400, "Password Is incorrect"));
  }

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
    const emailMessage = `Your Pin Code is: ${OTPCode}`;
    const emailSubject = "NetWorth";
    const emailSend = await SendEmailUtils(email, emailMessage, emailSubject);

    user.password = undefined;
    res
      .status(200)
      .json({ status: true, message: "Check Email For OTP verification" });
  }
});

//verify login
exports.verifyLoginOTP = catchAsync(async (req, res, next) => {
  const { email, otp } = req.body;
  // console.log(req.body)

  // Check if user with the given email exists
  const user = await userModel.findOne({ email });

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
    const accessToken = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        email: user.email,
      },
      process.env.SECRET_KEY,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
      }
    );

    res.status(200).json({
      status: "success",
      data: user,
      accessToken: accessToken,
      refreshToken: refreshToken,
    });
  } else {
    res.status(200).json({ status: false, message: "Invalid OTP Code" });
  }
});

exports.generateAccessToken = catchAsync(async (req, res, next)=>{
    const { refreshToken } = req.body;

    // Verify the refresh token and get userId
    const verificationResult = await verifyRefreshToken.verifyRefresh(
      refreshToken
    );
    // console.log(verificationResult);

    if (!verificationResult.valid) {
        return next(new ErrorHandler(401, "Invalid token, try logging in again"))
    }

    const { userId } = verificationResult;
    // console.log("User ID:", userId);

    // Find the user based on userId
    const user = await userModel.findById(userId);
    // console.log("User:", user);

    if (!user) {
      return next(new ErrorHandler(400, "User not found"))
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
})
