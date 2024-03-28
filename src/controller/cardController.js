const { catchAsync } = require("../middleware/catchAsyncError");
const cardModel = require("../model/cardModel");
const userModel = require("../model/userModel");
const activityModel = require("../model/ActivityModel");
const linkModel = require("../model/linkModel");
const ErrorHandler = require("../utils/errorHandler");
const { encryptData, decryptData } = require("../utils/encryptAndDecryptUtils");
const { load } = require("cheerio");
const axios = require("axios");

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

exports.deleteCardById = catchAsync(async (req, res, next) => {
  const cardId = req.params.id;
  const card = await cardModel.findByIdAndDelete(cardId);

  if (!card) {
    return next(new ErrorHandler(404, "Something is Wrong With This Card"));
  }

  return res.status(200).json({
    status: true,
    message: "Card Delete Successfully",
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

exports.deleteActivityByIdd = catchAsync(async (req, res, next) => {
  const activityId = req.params.id;
  const activity = await activityModel.findByIdAndDelete(activityId);
  if (!activity) {
    return next(new ErrorHandler(404, "Something Is Wrong With This Activity"));
  }
  return res.status(200).json({
    status: true,
    message: "Successfully Delete This Activity",
  });
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

exports.linkDeleteById = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  const link = await linkModel.findByIdAndDelete(id);
  if (!link) {
    return next(new ErrorHandler(404, "Something is wrong with the link"));
  }
  return res.status(200).json({
    status: true,
    message: "Successfully Delete This Link",
  });
});

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
  const userId = req.headers.userId;
  const card = await cardModel.findById(card_id);
  if (!card) {
    return next(new ErrorHandler(200, "Card Id Not Valid"));
  }

  const encryptionKey = process.env.INVITATION_ENCRYPTION_KEY;

  // Ensure card._id is converted to string before encryption
  const encryptedCardId = encryptData(card?._id.toString(), encryptionKey);
  const encryptedUserId = encryptData(userId.toString(), encryptionKey);

  // Construct the URL using encrypted IDs
  const url = `${process.env.QR_CODE_REDIRECT_LINK}/from=qr?cardId=${encryptedCardId}&userId=${encryptedUserId}`;

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

exports.getMetaData = async (req, res) => {
  try {
    //get url to generate preview, the url will be based as a query param.

    const { url } = req.query;
    /*request url html document*/
    const { data } = await axios.get(url);
    //load html document in cheerio
    const $ = load(data);

    /*function to get needed values from meta tags to generate preview*/
    const getMetaTag = (name) => {
      return (
        $(`meta[name=${name}]`).attr("content") ||
        $(`meta[propety="twitter${name}"]`).attr("content") ||
        $(`meta[property="og:${name}"]`).attr("content")
      );
    };

    /*Fetch values into an object */
    const preview = {
      url,
      title: $("title").first().text(),
      favicon:
        $('link[rel="shortcut icon"]').attr("href") ||
        $('link[rel="alternate icon"]').attr("href"),
      description: getMetaTag("description"),
      image: getMetaTag("image"),
      author: getMetaTag("author"),
    };

    //Send object as response
    res.status(200).json(preview);
  } catch (error) {
    res
      .status(500)
      .json(
        "Something went wrong, please check your internet connection and also the url you provided"
      );
  }
};

//for homepage feed
exports.showAllActivities = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  // Find the card with the provided id and populate the 'friend_list' field
  const friend_list = await cardModel
    .findById(id)
    .select(
      "-design -email -phone_number -links -activities -incoming_friend_request -outgoing_friend_request -address -bio -card_name -color -company_logo -company_name -cover_image -designation -name -profile_image -status"
    )
    .populate({
      path: "friend_list",
      model: "Card",
      select:
        "-design -links -incoming_friend_request -outgoing_friend_request -address -bio -card_name -color -company_logo -company_name -cover_image -designation -status -friend_list -phone_number -email",
      populate: {
        path: "activities",
        model: "Activity",
      },
    });

  if (!friend_list) {
    return res.status(404).json({
      status: false,
      message: "Card not found",
    });
  }

  return res.status(200).json({
    status: true,
    data: friend_list,
  });
});

//show all friend
exports.showFriendListForCard = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  const friendList = await cardModel
    .findById(id)
    .populate({
      path: "friend_list",
      model: "Card",
      select:
        "-design -links -incoming_friend_request -outgoing_friend_request -address -bio -card_name -color -company_logo -company_name -cover_image -designation -status -phone_number -email -activities -friend_list",
    })
    .select(
      "-design -email -phone_number -links -activities -incoming_friend_request -outgoing_friend_request -address -bio -card_name -color -company_logo -company_name -cover_image -designation -name -profile_image -status"
    );

  if (!friendList) {
    return res.status(404).json({
      status: false,
      message: "Card not found",
    });
  }

  return res.status(200).json({
    status: true,
    data: friendList,
  });
});
