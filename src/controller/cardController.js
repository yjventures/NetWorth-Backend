const { catchAsync } = require("../middleware/catchAsyncError");
const cardModel = require("../model/cardModel");
const userModel = require("../model/userModel");
const activityModel = require("../model/ActivityModel");
const linkModel = require("../model/linkModel");
const ErrorHandler = require("../utils/errorHandler");
const { encryptData, decryptData } = require("../utils/encryptAndDecryptUtils");
const { load } = require("cheerio");
const axios = require("axios");
const tempCardModel = require("../model/tempCardModel");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
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
  const userId = req.headers.userId;

  try {
    const user = await userModel.findById(userId);
    if (!user) {
      return next(new ErrorHandler(404, "User not found"));
    }

    const card = await cardModel.findByIdAndDelete(cardId);
    if (!card) {
      return next(new ErrorHandler(404, "Card not found"));
    }

    // Remove cardId from user's cards array
    user.cards.pull(cardId);
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Card deleted successfully",
    });
  } catch (error) {
    return next(new ErrorHandler(500, "Internal Server Error"));
  }
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

exports.getSigleActivity = catchAsync(async (req, res, next) => {
  const activityId = req.params.activityId;
  const card = await cardModel
    .findOne({ activities: activityId })
    .populate("activities")
    .select("name profile_image");
  if (!card) {
    return next(
      new ErrorHandler(404, "Your selected card not found in this page")
    );
  }

  // console.log(card)

  const activity = card.activities[0];

  if (!activity) {
    return next(
      new ErrorHandler(404, "The Activity is not available on the Card")
    );
  }

  return res.status(200).json({
    status: true,
    data: {
      card: { name: card.name, profile_image: card.profile_image },
      activity: activity,
    },
  });
});

exports.updateActivity = catchAsync(async (req, res, next) => {
  const activityId = req.params.activityId;
  const reqBody = req.body;
  const activity = await activityModel.findByIdAndUpdate(activityId, reqBody, {
    new: true,
  });

  if (!activity) {
    return next(new ErrorHandler(404, "Something Is Wrong With This Activity"));
  }

  return res.status(200).json({
    status: true,
    message: "Successfully Updated This Activity",
    data: activity,
  });
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
  const url = `${process.env.QR_CODE_REDIRECT_LINK}?cardId=${encryptedCardId}&userId=${encryptedUserId}`;

  return res.status(200).json({
    status: true,
    data: {
      url: url,
    },
  });
});

//decrypt link share
exports.decryptQRCodeLink = catchAsync(async (req, res, next) => {
  // const encryptId = req.params.id;
  const card_encrypt_id = req.query.card_encrypt_id;
  const user_encrypt_id = req.query.user_encrypt_id;
  // console.log(card_encrypt_id, user_encrypt_id);

  const encryptionKey = process.env.INVITATION_ENCRYPTION_KEY;
  const decryptedCardId = decryptData(card_encrypt_id, encryptionKey);
  // console.log("decryptedCardId",decryptedCardId)

  const decryptedUserId = decryptData(user_encrypt_id, encryptionKey);

  const card = await cardModel
    .findById(decryptedCardId)
    .populate({ path: "links", model: "Link", select: "link platform" })
    .populate({ path: "activities", model: "Activity" });

  const user = await userModel.findById(decryptedUserId);
  if (!card) {
    return next(new ErrorHandler(200, "URL's Card Not Valid"));
  }
  if (!user) {
    return next(new ErrorHandler(200, "URL's User Not Valid"));
  }

  return res.status(200).json({
    status: true,
    data: {
      cardInfo: card,
      userInfo: user?._id,
    },
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

//for homepage feeds
exports.showAllActivities = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  // Find the card with the provided id and populate the 'friend_list' field
  const card = await cardModel
    .findById(id)
    .select(
      "-design -email -phone_number -links -incoming_friend_request -outgoing_friend_request -address -bio -color -company_logo -company_name -cover_image -designation -status"
    )
    .populate({
      path: "friend_list",
      model: "Card",
      select:
        "-design -links -incoming_friend_request -outgoing_friend_request -address -bio -color -company_logo -company_name -cover_image -designation -status -friend_list -phone_number -email",
      populate: {
        path: "friend",
        model: "Card",
        select: "name profile_image", // Select only necessary fields from friend
        populate: {
          path: "activities",
          model: "Activity",
        },
      },
    });

  if (!card) {
    return res.status(404).json({
      status: false,
      message: "Card not found",
    });
  }

  // Extract all activities from the friend_list
  const allActivities = card?.friend_list?.reduce((acc, friend) => {
    if (
      friend.friend &&
      friend.friend.activities &&
      friend.friend.activities.length > 0
    ) {
      acc.push(
        ...friend.friend.activities.map((activity) => {
          // console.log(activity);
          return {
            card: {
              _id: friend.friend._id,
              name: friend.friend.name,
              profile_image: friend.friend.profile_image,
            },
            activity: activity,
          };
        })
      );
    }

    return acc;
  }, []);

  return res.status(200).json({
    status: true,
    data: allActivities,
  });
});

//show all friend
exports.showFriendListForCard = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  const card = await cardModel.findById(id).populate({
    path: "friend_list",
    model: "Card",
    select: "friend",
    populate: {
      path: "friend",
      model: "Card",
      select: "name profile_image designation company_name calendly_link",
    },
  });

  // console.log(card)

  if (!card) {
    return res.status(404).json({
      status: false,
      message: "Card not found",
    });
  }

  const tempCards = await tempCardModel.find({ invited_card: id });

  const friendListArray = card?.friend_list;
  return res.status(200).json({
    status: true,
    data: { cards: friendListArray, tempCards },
  });
});

exports.checkCardOwner = catchAsync(async (req, res, next) => {
  const userId = req.headers.userId;
  const cardId = req.params.cardId;
  console.log(userId);

  const card = await cardModel.findById(cardId);
  if (!card) {
    return next(new ErrorHandler(404, "Card Not Found"));
  }

  const user = await userModel.findOne({ _id: userId, cards: cardId });

  if (!user) {
    return res.status(200).json({
      status: false,
      data: {
        isOwnId: false,
      },
    });
  } else {
    return res.status(200).json({
      status: true,
      data: {
        isOwnId: true,
      },
    });
  }
  // console.log("hello world")
});

//visitor count
exports.countTotalVisitior = catchAsync(async (req, res, next) => {
  const { token, card_id } = req.body;

  const decoded = jwt.verify(token, process.env.SECRET_KEY);

  const userId = decoded.userId;
  // console.log(userId)
  const card = await cardModel.findById(card_id);

  if (!card) {
    return next(new ErrorHandler(404, "Provided card does not exist"));
  }

  const user = await userModel.findById(userId).populate("cards");

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Check if the card_id exists in the user's cards array
  const cardExists = user.cards.some((card) => card._id.toString() === card_id);

  if (!cardExists) {
    const updatedCard = await cardModel.findOneAndUpdate(
      { _id: card_id },
      { $inc: { count: 1 } },
      { new: true, upsert: true }
    );
  }
  res.status(200).json({
    status: true,
    message: "Card count incremented and added to user",
  });
});

exports.cardAnalyticalData = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  try {
    // Find card data including invite_in_platform
    const card = await cardModel
      .findById(id)
      .select("total_points friend_list invite_in_platform");
    if (!card) {
      return next(new ErrorHandler(404, "Card not found"));
    }

    // Calculate additional data for main card
    const totalPoints = card.total_points;
    const friendListLength = card.friend_list.length;

    // Group main card friend_list by month and count incoming/outgoing for each month
    const mainCardMonthWiseCounts = card.friend_list.reduce((acc, friend) => {
      const monthYear = new Date(friend.time_stamp).toISOString().slice(0, 7); // Year-month format
      if (!acc[monthYear]) {
        acc[monthYear] = { incoming: 0, outgoing: 0, platformInvitation: 0 };
      }
      if (friend.from === "incoming") {
        acc[monthYear].incoming++;
      } else {
        acc[monthYear].outgoing++;
      }
      return acc;
    }, {});

    // Count platform invitations if present
    if (card.invite_in_platform) {
      const monthYear = new Date(card.invite_in_platform.time_stamp)
        .toISOString()
        .slice(0, 7);
      if (!mainCardMonthWiseCounts[monthYear]) {
        mainCardMonthWiseCounts[monthYear] = {
          incoming: 0,
          outgoing: 0,
          platformInvitation: 0,
        };
      }
      mainCardMonthWiseCounts[monthYear].platformInvitation +=
        card.invite_in_platform.number;
    }

    // Convert mainCardMonthWiseCounts object to array of objects with modified format
    const monthWiseCountsArray = Object.keys(mainCardMonthWiseCounts).map(
      (key) => {
        return {
          month: new Date(key + "-01").toLocaleString("en-us", {
            month: "short",
            year: "numeric",
          }), // Convert to short month format
          ...mainCardMonthWiseCounts[key],
        };
      }
    );

    // Sort monthWiseCountsArray by month in ascending order
    monthWiseCountsArray.sort((a, b) => {
      const dateA = new Date(a.month + " 01");
      const dateB = new Date(b.month + " 01");
      return dateA - dateB;
    });

    return res.status(200).json({
      status: true,
      data: {
        totalPoints,
        friendListLength,
        monthWiseCounts: monthWiseCountsArray,
      },
    });
  } catch (error) {
    return next(new ErrorHandler(500, "Internal Server Error"));
  }
});


