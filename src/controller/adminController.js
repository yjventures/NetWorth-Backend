const { catchAsync } = require("../middleware/catchAsyncError");
const userModel = require("../model/userModel");
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
  const user = await userModel.find();
  if (!user) {
    return next(new ErrorHandler(404, "User Not Found"));
  }

  return res.status(200).json({
    status: true,
    data: user,
  });
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

  const user =await userModel.findByIdAndDelete(userId);

//   console.log(user)
  if (!user) {
    return next(new ErrorHandler(404, "This User Not Found"));
  }

  return res.status(200).json({
    status: true,
    message: "Successfully Deleted The User",
    data: user,
  });
});
