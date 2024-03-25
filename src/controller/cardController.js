const { catchAsync } = require("../middleware/catchAsyncError");
const cardModel = require("../model/cardModel");
const userModel = require("../model/userModel");
const activityModel = require("../model/ActivityModel");
const linkModel = require("../model/linkModel");
const ErrorHandler = require("../utils/errorHandler");
const { encryptData, decryptData } = require("../utils/encryptAndDecryptUtils");

//create empty card
exports.createCard = catchAsync(async (req, res, next) => {
  const userId = req.headers.userId;
  const user = await userModel.findById(userId);
  if (!user) {
    return next(new ErrorHandler(404, "User Not Found"));
  }

  const newCard = await cardModel.create({});
  if (!newCard) {
    return next(new ErrorHandler(404, "Something Is Wrong With Creation Card"));
  }

  user.cards.push(newCard?._id);
  await user.save();

  return res.status(200).json({
    status: true,
    message: "Card Created Successfully",
    data: newCard,
  });
});

exports.updateCard = catchAsync(async (req, res, next) => {
  const cardId = req.params.cardId;
  const updates = req.body;

  const card = await cardModel.findByIdAndUpdate(cardId, updates, {
    new: true,
  });

  if (!card) {
    return res.status(404).json({
      status: false,
      message: "Card not found",
      data: null,
    });
  }

  return res.status(200).json({
    status: true,
    message: "Card updated successfully",
    data: card,
  });
});

exports.getCardById = catchAsync(async (req, res, next) => {
  const cardId = req.params.cardId;
  const card = await cardModel
    .findById(cardId)
    .populate({ path: "links", model: "Link", select: "link platform" })
    .populate({ path: "activities", model: "Activity" });

  if (!card) {
    return next(new ErrorHandler(404, "Card Not Found"));
  }

  return res.status(200).json({
    status: true,
    data: card,
  });
});

exports.getAllCard = catchAsync(async (req, res, next) => {
  const userId = req.headers.userId;
  const user = await userModel
    .findById(userId)
    .populate([
      {
        path: "cards",
        model: "Card",
        populate: {
          path: "links",
        },
      },
      {
        path: "cards",
        model: "Card",
        populate: {
          path: "activities",
        },
      },
    ])

    .select("cards");

  if (!user) {
    return next(new ErrorHandler(404, "User Not Found"));
  }

  return res.status(200).json({
    status: true,
    data: user,
  });
});

//create activity
exports.createActivity = catchAsync(async (req, res, next) => {
  const cardId = req.params.cardId;
  const reqBody = req.body;

  const card = await cardModel.findById(cardId);
  if (!card) {
    return next(new ErrorHandler(404, "The Card is not found"));
  }

  const activity = await activityModel.create(reqBody);

  if (!activity) {
    return next(
      new ErrorHandler(404, "Something Is Wrong With Activity Creation")
    );
  }

  card.activities.push(activity._id);
  await card.save();

  return res.status(200).json({
    status: true,
    message: "Activity has been added to the card",
    data: activity,
  });
});

//get all activities
exports.getAllActivity = catchAsync(async (req, res, next) => {
  const cardId = req.params.cardId;

  try {
    const card = await cardModel
      .findById(cardId)
      .populate({ path: "activities", model: "Activity" });

    if (!card) {
      return res.status(404).json({
        status: false,
        message: "Card not found",
      });
    }

    if (card.activities.length === 0) {
      return res.status(200).json({
        status: false,
        message: "This card does not have any activities",
        data: [],
      });
    }

    return res.status(200).json({
      status: true,
      message: "Activities retrieved successfully",
      data: card.activities,
    });
  } catch (error) {
    return next(new ErrorHandler(500, "Internal Server Error"));
  }
});

exports.createLink = catchAsync(async (req, res, next) => {
  const cardId = req.params.cardId;
  const reqBody = req.body;

  const card = await cardModel.findById(cardId);
  if (!card) {
    return next(new ErrorHandler(404, "The Card is not found"));
  }

  const link = await linkModel.create(reqBody);

  if (!link) {
    return next(new ErrorHandler(404, "Something Is Wrong With Link Creation"));
  }

  card.links.push(link._id);
  await card.save();

  return res.status(200).json({
    status: true,
    message: "Link has been added to the card",
    data: link,
  });
});

//get all links
exports.getAllLink = catchAsync(async (req, res, next) => {
  const cardId = req.params.cardId;

  try {
    const card = await cardModel
      .findById(cardId)
      .populate({ path: "links", model: "Link" });

    if (!card) {
      return res.status(404).json({
        status: false,
        message: "Card not found",
      });
    }

    if (card.links.length === 0) {
      return res.status(200).json({
        status: false,
        message: "This card does not have any link",
        data: [],
      });
    }

    return res.status(200).json({
      status: true,
      message: "Link retrieved successfully",
      data: card.links,
    });
  } catch (error) {
    return next(new ErrorHandler(500, "Internal Server Error"));
  }
});

exports.linkDeleteById = catchAsync(async (req, res, next)=>{
  const id = req.params.id;

  const link = await linkModel.findByIdAndDelete(id);
  if(!link){
    return next(new ErrorHandler(404,"Something is wrong with the link"));
  }
  return res.status(200).json({
    status: true,
    message: "Successfully Delete This Link"
  })
})

//card status update
exports.updateCardStatus = catchAsync(async (req, res, next) => {
  const cardId = req.params.cardId;
  const { status } = req.body;

  const card = await cardModel.findByIdAndUpdate(
    cardId,
    {
      status: status,
    },
    {
      new: true,
    }
  );

  if (!card) {
    return res.status(404).json({
      status: false,
      message: "Something Is Wrong With This Card",
      data: null,
    });
  }

  return res.status(200).json({
    status: true,
    message: "Status Update Successfully",
    data: card,
  });
});

//profile link share
exports.generateQRCodeLink = catchAsync(async (req, res, next) => {
  const card_id = req.params.id;

  const card = await cardModel.findById(card_id);
  if (!card) {
    return next(new ErrorHandler(200, "Card Id Not Valid"));
  }

  const encryptionKey = process.env.INVITATION_ENCRYPTION_KEY;

  // Ensure card._id is converted to string before encryption
  const encryptId = encryptData(card?._id.toString(), encryptionKey);
  const url = `${process.env.QR_CODE_REDIRECT_LINK}/${encryptId}`;

  return res.status(200).json({
    status: true,
    data: {
      url: url,
    },
  });
});

//decrypt link share
exports.decryptQRCodeLink = catchAsync(async (req, res, next) => {
  const encryptId = req.params.id;

  const encryptionKey = process.env.INVITATION_ENCRYPTION_KEY;
  const decryptedId = decryptData(encryptId, encryptionKey);

  const card = await cardModel.findById(decryptedId);
  if (!card) {
    return next(new ErrorHandler(200, "URL not valid"));
  }

  return res.status(200).json({
    status: true,
    data: card,
  });
});
