const { catchAsync } = require("../middleware/catchAsyncError");
const userModel = require("../model/userModel");
const SendEmailUtils = require("../utils/SendEmailUtils");
const ErrorHandler = require("../utils/errorHandler");
const userBcrypt = require("../utils/userBcrypt");
const jwt = require("jsonwebtoken");

exports.adminLogin = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new ErrorHandler(400, "Email Or Password Required"));
  }
  const adminEmail = process.env.ADMIN_EMAIL;

  if (email !== adminEmail) {
    return next(new ErrorHandler(403, "You Are Not Authorized"));
  }

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
  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Sorting
  let sortQuery = {};
  if (req.query.sortBy && req.query.sortOrder) {
    sortQuery[req.query.sortBy] = req.query.sortOrder === "desc" ? -1 : 1;
  } else {
    sortQuery.name = 1;
  }

  // Filtering by email
  let filterQuery = {};
  if (req.query.email) {
    filterQuery.email = { $regex: new RegExp(req.query.email, "i") };
  }

  const totalUsers = await userModel.countDocuments(filterQuery);

  const user = await userModel
    .find(filterQuery)
    .sort(sortQuery)
    .skip(skip)
    .limit(limit)
    .populate({ path: "personal_info", select: "name profile_image" });

  if (user.length === 0) {
    return next(new ErrorHandler(404, "No users found"));
  }

  const totalPages = Math.ceil(totalUsers / limit);

  const responseData = {
    status: true,
    data: user,
    page: page,
    limit: limit,
    sortBy: req.query.sortBy,
    sortOrder: req.query.sortOrder || "asc",
    currentPage: user.length === 0 ? 0 : page,
    totalPages: totalPages,
  };

  return res.status(200).json(responseData);
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
    .populate("cards");

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
