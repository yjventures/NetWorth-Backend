const { catchAsync } = require("../middleware/catchAsyncError");
const cardModel = require("../model/cardModel");
const SendEmailUtils = require("../utils/SendEmailUtils");
const { encryptData } = require("../utils/encryptAndDecryptUtils");
const ErrorHandler = require("../utils/errorHandler");

exports.sendInvitationViaEmail = catchAsync(async (req, res, next) => {
  const { sender_card_id, recipient_email } = req.body;

  const recipientCard = await cardModel.findOne({
    email: { $in: [recipient_email] },
  });
  if (!recipientCard) {

  }
  const sender = await cardModel.findById(sender_card_id);

  if (!sender) {
    return next(new ErrorHandler(401, "You Card Is Not Authenticated"));
  }

  console.log(recipientCard);
  const senderEncryptId = encryptData(sender._id.toString());
  //   console.log("hello world",recipientEncryptId)
  const url = `${process.env.INVITATION_LINK_VIA_MAIL}/${senderEncryptId.encryptedText}`;

//   console.log(recipientCard);
  console.log(url);
  const emailMessage = `You Have a Invitation Request . ${url}`;
  const emailSubject = "NetWorth";
  const emailSend = await SendEmailUtils(recipientCard.email, emailMessage, emailSubject);

  return res
    .status(200)
    .json({ status: true, message: "Send Invitation Via Email" });
});


exports.searchContact = catchAsync(async (req, res, next) => {
  const { name, country, city, designation, company } = req.query;
  let query = {};

  if (name) {
    query.name = { $regex: name, $options: 'i' };
  }
  if (country) {
    query.email = { $regex: email, $options: 'i' };
  }
  if (phone_number) {
    query.phone_number = { $regex: phone_number, $options: 'i' };
  }
  if (designation) {
    query.designation = { $regex: designation, $options: 'i' };
  }
  if (company) {
    query.company_name = { $regex: company, $options: 'i' };
  }

  console.log(query);

  // Execute the query
  const searchResult = await cardModel.find(query);

  res.status(200).json({
    status: true,
    data: searchResult,
  });
});
