const { catchAsync } = require("../middleware/catchAsyncError");
const cardModel = require("../model/cardModel");
const tempCardModel = require("../model/tempCardModel");
const { encryptData } = require("../utils/encryptAndDecryptUtils");
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

  // Check if the card existance
  const inviteeCard = await cardModel.findById(invited_card);
  if (!inviteeCard) {
    return next(new ErrorHandler(404, "Your Card Not Found"));
  }
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

  inviteeCard.friend_list.push(newTempCard?._id);
  await inviteeCard.save();

  const encryptionKey = process.env.INVITATION_ENCRYPTION_KEY;

  const encryptedTempCardId = encryptData(
    newTempCard?._id.toString(),
    encryptionKey
  );

  const urlEmail = email[0];
  const encryptedURL = `${urlEmail}-${encryptedTempCardId}`;

  const emailMessage = `You have an Invitation from the NetWorthHub ${process.env.INVITATION_LINK}?encrypted=${encryptedURL}`;

  const emailSubject = "NetWorth";
  const emailSend = await SendEmailUtils(email[0], emailMessage, emailSubject);

  res.status(201).json({
    status: true,
    message: "Invitation Sent Successfully",
    data: newTempCard,
  });
});
