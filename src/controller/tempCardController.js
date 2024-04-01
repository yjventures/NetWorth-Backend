const { catchAsync } = require("../middleware/catchAsyncError");
const cardModel = require("../model/cardModel");
const tempCardModel = require("../model/tempCardModel");
const ErrorHandler = require("../utils/errorHandler");
const SendEmailUtils = require("../utils/SendEmailUtils");


exports.createTempCard = catchAsync(async (req, res, next) => {
  const {
    name,
    company_name,
    address,
    email,
    designation,
    phone_number,
    invited_card,
  } = req.body;

  // Check if email exists in tempCardModel
  const existingEmailsTempCard = await tempCardModel.find({
    email: { $in: email },
  });
  if (existingEmailsTempCard.length > 0) {
    const existingEmailsList = existingEmailsTempCard.map(
      (existingEmail) => existingEmail.email
    );
    return next(
      new ErrorHandler(400, `${existingEmailsList} already exist in Card`)
    );
  }

  // Check if email exists in cardModel
  const existingEmailsCard = await cardModel.find({ email: { $in: email } });
  if (existingEmailsCard.length > 0) {
    const existingEmailsList = existingEmailsCard.map(
      (existingEmail) => existingEmail.email
    );
    return next(
      new ErrorHandler(400, `${existingEmailsList} already exist in Card`)
    );
  }

  // If no email exists in either model, create a new TempCard
  const newTempCard = await tempCardModel.create({
    name,
    company_name,
    address,
    email,
    designation,
    phone_number,
    invited_card,
  });

  const emailMessage = `You have a Invitation from the NetWorthHub`;
  const emailSubject = "NetWorth";
  const emailSend = await SendEmailUtils(email[0], emailMessage, emailSubject);

  res.status(201).json({
    status: true,
    message: "Invitation Sent Successfully",
    data: newTempCard,
  });
});
