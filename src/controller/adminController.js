const { catchAsync } = require("../middleware/catchAsyncError");
const cardModel = require("../model/cardModel");
const userModel = require("../model/userModel");
const SendEmailUtils = require("../utils/SendEmailUtils");
const ErrorHandler = require("../utils/errorHandler");
const userBcrypt = require("../utils/userBcrypt");
const jwt = require("jsonwebtoken");
const generator = require("generate-password");
const personalInfoModel = require("../model/personalInfoModel");
const tempPasswordModel = require("../model/tempPasswordModel");
const {
  generateLinkForTeamMember,
} = require("../utils/encryptAndDecryptUtils");
const moment = require("moment");
const tempCardModel = require("../model/tempCardModel");

exports.adminLogin = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new ErrorHandler(400, "Email Or Password Required"));
  }
  // const adminEmail = process.env.ADMIN_EMAIL;

  // if (email !== adminEmail) {
  //   return next(new ErrorHandler(403, "You Are Not Authorized"));
  // }

  const user = await userModel.findOne({ email: email, role: "admin" });

  const match = await userBcrypt.comparePassword(password, user.password);
  if (!match) {
    return next(new ErrorHandler(400, "Password Is incorrect"));
  }

  const accessToken = jwt.sign(
    {
      userId: user?._id,
      email: user?.email,
      role: user?.role,
    },
    process.env.ADMIN_SECRET_KEY,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  return res.status(200).json({
    success: true,
    message: "Admin Login Successful",
    accessToken: accessToken,
  });
});

exports.allUser = catchAsync(async (req, res, next) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let sortQuery = { createdAt: -1 };
    if (req.query.sortBy && req.query.sortOrder) {
      sortQuery[req.query.sortBy] = req.query.sortOrder === "desc" ? -1 : 1;
    }

    let filterQuery = {};
    if (req.query.search) {
      filterQuery.$or = [
        { email: { $regex: new RegExp(req.query.search, "i") } },
        { "personal_info.name": { $regex: new RegExp(req.query.search, "i") } },
      ];
    }

    const totalUsers = await userModel.countDocuments(filterQuery);

    const users = await userModel
      .find(filterQuery)
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .populate({ path: "personal_info", select: "name profile_image" });

    if (users.length === 0) {
      return res.status(200).json({
        status: false,
        message: "No users found",
        data: [],
      });
    }

    const totalPages = Math.ceil(totalUsers / limit);

    const responseData = {
      status: true,
      data: users,
      metaData: {
        totalUser: totalUsers,
        page: page,
        limit: limit,
        sortBy: req.query.sortBy || "createdAt", // Default sortBy to createdAt
        sortOrder: req.query.sortOrder || "desc", // Default sortOrder to desc
        currentPage: page,
        totalPages: totalPages,
      },
    };

    return res.status(200).json(responseData);
  } catch (error) {
    return next(error); // Pass any caught errors to the error handling middleware
  }
});

exports.getUserDetails = catchAsync(async (req, res, next) => {
  const userId = req.params.userId;
  const role = req.headers.role;

  if (role !== "admin") {
    return next(new ErrorHandler(401, "You Are Not Authorized"));
  }

  const user = await userModel
    .findById(userId)
    .populate("personal_info")
    .populate({ path: "cards", populate: "activities links" });

  if (!user) {
    return next(new ErrorHandler(404, "This User Details Not Found"));
  }

  return res.status(200).json({
    status: true,
    data: user,
  });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  //  console.log("clicked")
  const userId = req.params.userId;
  const role = req.headers.role;

  if (role !== "admin") {
    return next(new ErrorHandler(401, "You Are Not Authorized"));
  }

  const user = await userModel.findByIdAndDelete(userId);

  //   console.log(user)
  if (!user) {
    return next(new ErrorHandler(404, "This User Not Found"));
  }

  // console.log(user.email)
  const emailMessage = `Sorry, Your account has been Deleted from NetWorth Hub`;
  const emailSubject = "NetWorth";
  const emailSend = await SendEmailUtils(
    user.email,
    emailMessage,
    emailSubject
  );

  return res.status(200).json({
    status: true,
    message: "Successfully Deleted The User",
    data: user,
  });
});

// //get all friends list by card id
exports.getAllFriendsListByCardId = catchAsync(async (req, res, next) => {
  const cardId = req.params.id;
  const card = await cardModel
    .findById(cardId)
    .populate("links activities friend_list");
  if (!card) {
    return next(new ErrorHandler(404, "Something Is Wrong With This Card"));
  }

  return res.status(200).json({
    status: true,
    data: card,
  });
});

exports.addAdminTeamMember = async (req, res) => {
  const role = req.headers.role;
  const reqBody = req.body;
  try {
    if (role !== "admin") {
      return res.status(200).json({
        status: "fail",
        message: "You are not allowed to add this team member feature",
      });
    }
    let newMemberInfo;
    const passwordCode = generator.generate({
      length: 20,
      numbers: true,
    });

    const existUser = await userModel.findOne({ email: reqBody?.email });

    if (existUser) {
      return res.status(400).json({
        status: "fail",
        message: "user is already registered in this platform",
      });
    }

    const personalInfo = await personalInfoModel.create({
      name: reqBody.name,
    });

    const newTeamMember = await userModel.create({
      email: reqBody.email,
      // admin_role: reqBody.role,
      role: "admin",
      password: passwordCode,
      personal_info: personalInfo?._id,
    });

    newMemberInfo = newTeamMember;

    const userCount = await userModel.aggregate([
      { $match: { email: reqBody.email } },
      { $count: "total" },
    ]);

    if (userCount.length > 0) {
      // Insert OTP into the database
      await tempPasswordModel.create({
        email: reqBody.email,
        password: passwordCode,
      });
      const confirmationToken = generateLinkForTeamMember(newMemberInfo.email);

      // Send a confirmation email to the user
      const emailMessage = `your temp password is  ${passwordCode} <br/> Click here to confirm your invitation as Admin: ${confirmationToken}`;

      const emailSubject = "NetworthHub System Invitation Account Confirmation";
      const emailSend = await SendEmailUtils(
        newMemberInfo.email,
        emailMessage,
        emailSubject
      );
      newMemberInfo.password = undefined;
      res.status(200).json({
        status: true,
        message: "Mail successfully sent to the invited member mail",
        data: newMemberInfo,
        emailInfo: emailSend,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.checkTempPasswordAsAdmin = async (req, res) => {
  const { email, password } = req.body;

  const user = await userModel.findOne({
    email: email,
    password: password,
    role: "admin",
  });

  // console.log("email",email)

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  let status = 0;
  try {
    const passwordCount = await tempPasswordModel.aggregate([
      { $match: { email: email, password: password, status: status } },
      { $count: "total" },
    ]);

    if (passwordCount.length > 0) {
      await tempPasswordModel.updateOne(
        { email, password, status: status },
        { email, password, status: 1 }
      );

      return res.status(200).json({
        status: true,
        message: "temp password verified successfully.",
        data: user,
      });
    } else {
      return res.status(401).json({ message: "Invalid OTP." });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.confirmMemberRegistration = async (req, res) => {
  try {
    const password = req.body.password;
    const invitedUserId = req.params.invitedUserId;

    const user = await userModel.findById(invitedUserId);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const regex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@.#$!%*?&])[A-Za-z\d@.#$!%*?&]{8,15}$/;

    if (!regex.test(password)) {
      return res.status(400).json({
        status: "fail",
        message:
          "Invalid password format. Password must have at least one lowercase letter, one uppercase letter, one digit, one special character, and be 8-15 characters long.",
      });
    }

    const hashedPassword = await userBcrypt.hashPassword(password);

    user.password = hashedPassword;
    user.is_verified = true;
    user.is_completed_personal_info = true;

    // Save the updated user
    await user.save();

    user.password = undefined;

    res.status(200).json({
      status: true,
      data: user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: error.message });
  }
};

exports.showAllAdmin = catchAsync(async (req, res, next) => {
  const role = req.headers.role;

  if (role !== "admin") {
    return next(new ErrorHandler(401, "You Are Not Authorized"));
  }

  const users = await userModel
    .find({ role: "admin" })
    .populate({ path: "personal_info", select: "name" });

  return res.status(200).json({
    status: true,
    data: users,
  });
});

exports.showAllStatistics = catchAsync(async (req, res, next) => {
  const role = req.headers.role;

  if (role !== "admin") {
    return next(new ErrorHandler(401, "You Are Not Authorized"));
  }

  const filter = req.query.filter; // Get the filter from query parameters

  let startDate, endDate;

  // Set start and end dates based on the filter
  switch (filter) {
    case "12months":
      startDate = moment().subtract(12, "months").startOf("day");
      endDate = moment().endOf("day");
      break;
    case "30days":
      startDate = moment().subtract(30, "days").startOf("day");
      endDate = moment().endOf("day");
      break;
    case "7days":
      startDate = moment().subtract(7, "days").startOf("day");
      endDate = moment().endOf("day");
      break;
    case "24hours":
      startDate = moment().subtract(24, "hours").startOf("hour");
      endDate = moment().endOf("hour");
      break;
    case "all": // Added "all" option
      startDate = moment(0); // Start of time
      endDate = moment().endOf("day");
      break;
    default:
      // Default to showing all data
      startDate = moment(0); // Start of time
      endDate = moment().endOf("day");
  }

  // Assuming "userModel" is your User model
  const userModelLength = await userModel.countDocuments({
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
  });

  const cardModelLength = await cardModel.countDocuments({
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
  });

  const inviteInPlatForm = await tempCardModel.countDocuments({
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
  });

  const signUpCount = await cardModel.countDocuments({
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
    via_invitation: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      totalUsersCount: userModelLength,
      totalCardsCount: cardModelLength,
      invitesPlatformCount: inviteInPlatForm,
      inviteSignUpCount: signUpCount,
    },
  });
});


