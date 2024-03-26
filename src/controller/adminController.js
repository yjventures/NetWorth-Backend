const { catchAsync } = require("../middleware/catchAsyncError");
const cardModel = require("../model/cardModel");
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
// exports.getAllFriendsListByCardId = catchAsync(async (req, res, next) => {
//   const cardId = req.params.id;
//   const card = await cardModel
//     .findById(cardId)
//     .populate("links activities friend_list");
//   if (!card) {
//     return next(new ErrorHandler(404, "Something Is Wrong With This Card"));
//   }

//   return res.status(200).json({
//     status: true,
//     data: card,
//   });
// });
