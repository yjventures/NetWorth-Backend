const { catchAsync } = require("../middleware/catchAsyncError");
const cardModel = require("../model/cardModel");
const notificationModel = require("../model/notificationModel");
const tempCardModel = require("../model/tempCardModel");
const userModel = require("../model/userModel");
const { encryptData, decryptData } = require("../utils/encryptAndDecryptUtils");
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

  inviteeCard.invite_in_platform.number += 1;
  inviteeCard.friend_list.push(newTempCard?._id);
  await inviteeCard.save();

  const encryptionKey = process.env.INVITATION_ENCRYPTION_KEY;

  const urlEmail = email[0];

  const objectToEncrypt = {
    email: urlEmail,
    cardId: newTempCard?._id.toString(),
  };
  const serializedObject = JSON.stringify(objectToEncrypt);
  const encryptedData = encryptData(serializedObject, encryptionKey);

  // const encryptedURL = `${urlEmail}-${encryptedTempCardId}`;

  const emailMessage = `You have an Invitation from the NetWorthHub ${process.env.INVITATION_LINK}?encrypted=${encryptedData}`;

  const emailSubject = "NetWorth";
  const emailSend = await SendEmailUtils(email[0], emailMessage, emailSubject);

  res.status(201).json({
    status: true,
    message: "Invitation Sent Successfully",
    data: newTempCard,
  });
});

//check encrypted temp card id
exports.decryptTempCardInvitation = catchAsync(async (req, res, next) => {
  const encryptionData = req.query.encrypt_data;
  // console.log(encryptionData)

  const encryptionKey = process.env.INVITATION_ENCRYPTION_KEY;

  const decryptedData = decryptData(encryptionData, encryptionKey);

  // Parse the decrypted JSON string back into an object
  const decryptedObject = JSON.parse(decryptedData);

  // console.log(decryptedObject)
  const tempCardId = decryptedObject?.cardId;

  // console.log(tempCardId)
  const tempCard = await tempCardModel.findById(tempCardId).populate({
    path: "invited_card",
    model: "Card",
    select: "company_name designation name profile_image",
  });

  if (!tempCard) {
    return next(new ErrorHandler(404, "Card Id not matched"));
  }

  // console.log(tempCard)
  return res.status(200).json({
    status: true,
    data: tempCard,
  });
});

exports.createNewCard = catchAsync(async (req, res, next) => {
  const userId = req.headers.userId;
  const tempCardId = req.query.temp_card_id;
  const inviteeCardId = req.query.invited_id;
  // console.log(inviteeCardId);

  const reqBody = req.body;

  try {
    const user = await userModel.findById(userId);
    if (!user) {
      return next(new ErrorHandler(400, "User not found"));
    }
    // Create a new card
    const newCard = await cardModel.create(reqBody);

    // Find the card to update
    const card = await cardModel.findOneAndUpdate(
      { _id: inviteeCardId },
      { $pull: { friend_list: tempCardId } },
      { new: true }
    );

    // console.log(card);

    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    if (newCard) {
      card.friend_list.push(newCard._id);
      newCard.friend_list.push(inviteeCardId);
      user.cards.push(newCard?._id);
      newCard.via_invitation = true;
      const notification = await notificationModel.create({
        sender: card?._id,
        receiver: newCard?._id,
        text: "accept your invitation and get 250 tokens",
      });

      card.notifications.push(notification?._id);
      await user.save();
      await card.save();
      await newCard.save();
    }

    const tempCardDelete = await tempCardModel.findByIdAndDelete(tempCardId);

    if (!tempCardDelete) {
      return next(new ErrorHandler(200, "Temp Card Deletation Error"));
    }

    return res.status(200).json({ message: "Successfully added new card" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});
