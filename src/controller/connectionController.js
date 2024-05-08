const { catchAsync } = require("../middleware/catchAsyncError");
const cardModel = require("../model/cardModel");
const personalInfoModel = require("../model/personalInfoModel");
const tempPasswordModel = require("../model/tempPasswordModel");
const userModel = require("../model/userModel");
const SendEmailUtils = require("../utils/SendEmailUtils");
const { encryptData } = require("../utils/encryptAndDecryptUtils");
const ErrorHandler = require("../utils/errorHandler");
const generator = require("generate-password");
const userBcrypt = require("../utils/userBcrypt");
const notificationModel = require("../model/notificationModel");
const { sendMultiplePushNotification } = require("../utils/fcmUtils");
const mongoose = require("mongoose");
const tempCardModel = require("../model/tempCardModel");

exports.searchContact = catchAsync(async (req, res, next) => {
  try {
    const userId = req.headers.userId;
    const cardId = req.params.cardId;
    const { search, country, city, designation } = req.query;
    let query = {};

    if (!search && !country && !city && !designation) {
      return res.status(200).json({
        status: true,
        data: [],
      });
    }

    if (search) {
      if (search.includes("@")) {
        query.email = { $regex: `^${search}`, $options: "i" };
      } else {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }
    }

    if (designation) {
      query.designation = { $regex: designation, $options: "i" };
    }

    // For city and country
    if (city && country) {
      const cityRegex = new RegExp(city, "i");
      const countryRegex = new RegExp(country, "i");
      query.address = {
        $regex: `${cityRegex.source}.*${countryRegex.source}`,
        $options: "i",
      };
    } else if (city) {
      const cityRegex = new RegExp(city, "i");
      query.address = {
        $regex: cityRegex.source,
        $options: "i",
      };
    } else if (country) {
      const countryRegex = new RegExp(country, "i");
      query.address = {
        $regex: countryRegex.source,
        $options: "i",
      };
      console.log(query);
    }

    // Exclude user's own cards
    const user = await userModel.findById(userId);
    const userCardIds = user.cards.map((card) => card.toString());
    query._id = { $nin: userCardIds };

    // Check if cardId exists and fetch the senderCard
    const senderCard = cardId ? await cardModel.findById(cardId) : null;

    // Execute the query
    const searchResult = await cardModel.find(query);

    // Iterate through search results to add button information
    const searchResultWithButtons = searchResult.map((result) => {
      let button = "";
      if (senderCard) {
        if (senderCard.outgoing_friend_request.includes(result._id)) {
          button = "outgoing";
        } else if (senderCard.incoming_friend_request.includes(result._id)) {
          button = "incoming";
        } else if (
          senderCard.friend_list.some(
            (friend) => friend.friend._id.toString() === result._id.toString()
          )
        ) {
          button = "friend";
        }
      }
      return { ...result.toObject(), button };
    });

    res.status(200).json({
      status: true,
      data: searchResultWithButtons,
    });
  } catch (error) {
    next(error);
  }
});

//send friend request
exports.sendConnectionRequest = catchAsync(async (req, res, next) => {
  const { sender_id, recipient_id } = req.body;

  // Find the sender and recipient cards
  const senderCard = await cardModel.findById(sender_id);
  // Check if either user does not exist
  if (!senderCard) {
    return next(new ErrorHandler(404, "Sender card not found"));
  }
  const recipientCard = await cardModel.findById(recipient_id);

  if (!recipientCard) {
    return next(new ErrorHandler(404, "Recipient card not found"));
  }

  // Check if the recipient is already in the sender's outgoing_friend_request
  const existsInOutgoing =
    senderCard.outgoing_friend_request.includes(recipient_id);

  if (existsInOutgoing) {
    return next(
      new ErrorHandler(403, "You Already send the connection request")
    );
  }

  const recipientIsConnected = senderCard?.friend_list?.some((friend) => {
    // console.log("Friend ID:", friend?._id?.toString());
    // console.log("Recipient ID:", recipient_id);
    return friend?.friend?._id?.toString() === recipient_id;
  });

  // console.log("recipientIsConnected", recipientIsConnected);

  if (recipientIsConnected) {
    return next(
      new ErrorHandler(403, "You are Already connected with this connectiion")
    );
  }

  const recipientIsInIncoming =
    senderCard?.incoming_friend_request.includes(recipient_id);
  if (recipientIsInIncoming) {
    return next(
      new ErrorHandler(403, "You received friend request from this user")
    );
  }

  // Add recipientCard to sender's outgoing_friend_request
  senderCard.outgoing_friend_request.push(recipientCard);

  // Add senderCard to recipient's incoming_friend_request
  recipientCard.incoming_friend_request.push(senderCard);

  // Create notification
  const notification = await notificationModel.create({
    sender: recipient_id,
    receiver: sender_id,
    text: "requested to connect",
    redirect_url: `/cards/${sender_id}?from=incoming_request`,
  });

  // Add notification to recipient's notifications
  recipientCard.notifications.push(notification._id);

  // Save changes to both cards
  await senderCard.save();
  await recipientCard.save();

  const user = await userModel.findOne({ cards: recipient_id });

  await sendMultiplePushNotification(
    user?._id,
    `You Received a connection request`
  );

  return res.status(200).json({
    status: true,
    message: "Connection request sent successfully.",
  });
});

//accept connection invitation
exports.acceptConnectionRequest = catchAsync(async (req, res, next) => {
  const { recipient_id, sender_id } = req.body;
  const senderCard = await cardModel.findById(sender_id);
  const recipientCard = await cardModel.findById(recipient_id);

  if (!senderCard) {
    return next(new ErrorHandler(404, "Sender not found"));
  }

  if (!recipientCard) {
    return next(new ErrorHandler(404, "Recipient not found"));
  }

  const isInIncoming =
    recipientCard.incoming_friend_request.includes(sender_id);
  
  const isInOutgoing =
    senderCard.outgoing_friend_request.includes(recipient_id);

  if (isInIncoming) {
    // Remove sender_id from recipientCard's incoming_friend_request
    recipientCard.incoming_friend_request =
      recipientCard.incoming_friend_request.filter(
        (id) => id.toString() !== sender_id.toString()
      );

    // Add sender_id to recipientCard's friend_list with a timestamp
    recipientCard.friend_list.push({
      friend: sender_id,
      from: "incoming",
      time_stamp: new Date(),
    });

    // Remove recipient_id from senderCard's outgoing_friend_request
    senderCard.outgoing_friend_request =
      senderCard.outgoing_friend_request.filter(
        (id) => id.toString() !== recipient_id.toString()
      );

    // Add recipient_id to senderCard's friend_list with a timestamp
    senderCard.friend_list.push({
      friend: recipient_id,
      time_stamp: new Date(),
    });
  } else if (isInOutgoing) {
    // Remove recipient_id from senderCard's outgoing_friend_request
    senderCard.outgoing_friend_request =
      senderCard.outgoing_friend_request.filter(
        (id) => id.toString() !== recipient_id.toString()
      );

    // Add recipient_id to senderCard's friend_list with a timestamp
    senderCard.friend_list.push({
      friend: senderCard,
      time_stamp: new Date(),
    });

    // Remove sender_id from recipientCard's incoming_friend_request
    recipientCard.incoming_friend_request =
      recipientCard.incoming_friend_request.filter(
        (id) => id.toString() !== sender_id.toString()
      );

    // Add sender_id to recipientCard's friend_list with a timestamp
    recipientCard.friend_list.push({
      friend: senderCard,
      time_stamp: new Date(),
    });
  } else {
    // If sender is not in either list, return an error
    return next(
      new ErrorHandler(
        404,
        "Connection accept request failed"
      )
    );
  }

  // Increment points for receiver and sender
  const pointsForReceiver = 250;
  const pointsForSender = 150;

  recipientCard.total_points += pointsForReceiver;
  senderCard.total_points += pointsForSender;

  const notification = await notificationModel.create({
    sender: sender_id,
    receiver: recipient_id,
    text: "accepted your connection request",
    redirect_url: `/cards/${recipient_id}?from=outgoing_request`,
  });

  senderCard.notifications.push(notification?._id);

  // Save the updated sender and recipient cards
  await senderCard.save();
  await recipientCard.save();

  const user = await userModel.findOne({ cards: sender_id });

  await sendMultiplePushNotification(user?._id, `Connection Request Accept`);
  return res.status(200).json({
    status: true,
    message: "Connection request accepted. Users are now friends.",
  });
});

//show incoming request
exports.showInComingRequestList = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  const incomingRequest = await cardModel.findById(id).populate({
    path: "incoming_friend_request",
    model: "Card",
  }).select(`
    -outgoing_friend_request 
    -friend_list
    -address
    -bio
    -card_name
    -color
    -company_logo
    -company_name
    -cover_image
    -designation
    -name
    -profile_image
    -design -email -phone_number -links -activities
  `);

  if (!incomingRequest) {
    return next(
      new ErrorHandler(200, "Something is Wrong With Card Incoming Request")
    );
  }

  return res.status(200).json({
    status: true,
    data: incomingRequest,
  });
});

//show out going request
exports.showOutGoingRequestList = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  const outgoingRequest = await cardModel.findById(id).populate({
    path: "outgoing_friend_request",
    model: "Card",
  }).select(`
    -incoming_friend_request 
    -friend_list
    -address
    -bio
    -card_name
    -color
    -company_logo
    -company_name
    -cover_image
    -designation
    -name
    -profile_image
    -design -email -phone_number -links -activities
  `);

  if (!outgoingRequest) {
    return next(
      new ErrorHandler(200, "Something is Wrong With Card outgoing Request")
    );
  }

  return res.status(200).json({
    status: true,
    data: outgoingRequest,
  });
});

//cancel incoming connection request
exports.cancelIncomingRequest = catchAsync(async (req, res, next) => {
  const { recipient_id, sender_id } = req.body;
  const senderCard = await cardModel.findById(sender_id);
  const recipientCard = await cardModel.findById(recipient_id);

  if (!senderCard) {
    return next(new ErrorHandler(404, "Something Wrong with Sender Card"));
  }

  if (!recipientCard) {
    return next(new ErrorHandler(404, "Something Wrong with Your Card"));
  }

  const isInIncoming =
    recipientCard.incoming_friend_request.includes(sender_id);

  if (isInIncoming) {
    recipientCard.incoming_friend_request =
      recipientCard.incoming_friend_request.filter(
        (id) => id.toString() !== sender_id.toString()
      );
    senderCard.outgoing_friend_request =
      senderCard.outgoing_friend_request.filter(
        (id) => id.toString() !== recipient_id.toString()
      );
  } else {
    return next(
      new ErrorHandler(
        404,
        "Sender not found in either incoming or outgoing requests"
      )
    );
  }

  // Save the updated sender and recipient cards
  await senderCard.save();
  await recipientCard.save();

  return res.status(200).json({
    status: true,
    message: "Connection Request Cancelled",
  });
});

//cancel outgoing connection request
exports.cancelOutgoingRequest = catchAsync(async (req, res, next) => {
  const { recipient_id, sender_id } = req.body;
  const senderCard = await cardModel.findById(sender_id);
  const recipientCard = await cardModel.findById(recipient_id);

  if (!senderCard) {
    return next(new ErrorHandler(404, "Something Wrong with Sender Card"));
  }

  if (!recipientCard) {
    return next(new ErrorHandler(404, "Something Wrong with Your Card"));
  }

  const isInOutgoing =
    senderCard.outgoing_friend_request.includes(recipient_id);

  if (isInOutgoing) {
    senderCard.outgoing_friend_request =
      senderCard.outgoing_friend_request.filter(
        (id) => id.toString() !== recipient_id.toString()
      );

    // Remove sender_id from recipientCard's incoming_friend_request
    recipientCard.incoming_friend_request =
      recipientCard.incoming_friend_request.filter(
        (id) => id.toString() !== sender_id.toString()
      );
  } else {
    return next(
      new ErrorHandler(
        404,
        "Sender not found in either incoming or outgoing requests"
      )
    );
  }

  // Save the updated sender and recipient cards
  await senderCard.save();
  await recipientCard.save();

  return res.status(200).json({
    status: true,
    message: "Connection Request Cancelled",
  });
});

exports.countUnreadNotifications = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  try {
    const card = await cardModel.findById(id).populate("notifications");
    if (!card) {
      return next(new ErrorHandler(404, "Card not found"));
    }

    // Filter notifications where read is false
    const unreadNotifications = card.notifications.filter(
      (notification) => notification.read === false
    );

    // console.log(unreadNotifications)
    const unreadCount = unreadNotifications.length;

    return res.status(200).json({
      status: true,
      data: {
        unreadCount,
      },
    });
  } catch (error) {
    return next(new ErrorHandler(500, "Internal Server Error"));
  }
});

exports.getUnreadNotificationIds = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  try {
    const card = await cardModel.findById(id).populate("notifications");
    if (!card) {
      return next(new ErrorHandler(404, "Card not found"));
    }

    // Filter notifications where read is false and extract their _id values
    const unreadNotificationIds = card.notifications
      .filter((notification) => !notification.read)
      .map((notification) => notification._id);

    return res.status(200).json({
      status: true,
      data: unreadNotificationIds,
    });
  } catch (error) {
    return next(new ErrorHandler(500, "Internal Server Error"));
  }
});

exports.markNotificationsAsRead = catchAsync(async (req, res, next) => {
  const { notificationIds } = req.body;

  try {
    // Check if notificationIds array is provided
    if (!notificationIds || !Array.isArray(notificationIds)) {
      return next(new ErrorHandler(400, "Notification IDs array is required"));
    }

    // Update notifications with provided IDs to set read field to true
    await notificationModel.updateMany(
      { _id: { $in: notificationIds } },
      { $set: { read: true } }
    );

    return res.status(200).json({
      status: true,
      message: "Notifications marked as read successfully",
    });
  } catch (error) {
    return next(new ErrorHandler(500, error));
  }
});

exports.checkCardInFriendListOrNot = catchAsync(async (req, res, next) => {
  const { own_id, other_id } = req.query;

  // console.log(own_id, other_id);
  const senderCard = await cardModel.findById(own_id);
  if (!senderCard) {
    return next(new ErrorHandler(404, "Sender card doesn't exit!"));
  }

  // console.log(senderCard);
  const recipientIsConnected = senderCard?.friend_list?.some((friend) => {
    // console.log("friend ", friend)
    // console.log("Friend ID:", friend?.friend?._id?.toString());
    // console.log("Recipient ID:", other_id);
    return friend?.friend?._id?.toString() === other_id;
  });

  // console.log(recipientIsConnected);
  return res.status(200).json({
    status: true,
    data: recipientIsConnected,
  });
});

exports.cardIniatializationFormInvitation = catchAsync(
  async (req, res, next) => {
    const userId = req.headers.userId;

    const user = await userModel.findById(userId);
    if (!user) {
      return next(new ErrorHandler(404, "user not found!"));
    }

    const { invited_id, temp_card_id } = req.body;

    // console.log(invited_id, temp_card_id)

    const invitedCard = await cardModel.findById(invited_id);
    if (!invitedCard) {
      return next(new ErrorHandler(404, "Invited card not found"));
    }

    // console.log(invitedCard)
    // return;
    const newCard = await cardModel.create({});

    // console.log(newCard)
    // return;
    if (!newCard) {
      return next(new ErrorHandler(404, "Card creation failed!"));
    }
    // invitedCard.friend_list.push(newCard);
    invitedCard?.friend_list?.push({
      friend: newCard,
      from: "",
      time_stamp: new Date(),
    });

    newCard?.friend_list?.push({
      friend: invitedCard,
      from: "",
      time_stamp: new Date(),
    });

    user?.cards.push(newCard);

    await invitedCard.save();
    await newCard.save();
    await user.save();

    // console.log("invitedCard", invitedCard)
    // console.log("new Card", newCard)

    // console.log(invitedCard)
    const tempCard = await tempCardModel.findByIdAndDelete(temp_card_id);

    if (!tempCard) {
      return next(
        new ErrorHandler(404, "Temporary card not found or already deleted!")
      );
    }
    // console.log("delete temp card ", tempCard);

    return res.status(200).json({
      status: true,
      data: newCard?._id,
    });
  }
);

exports.unfriendMutualFriend = catchAsync(async (req, res, next) => {
  const { own_id, remove_friend_id } = req.body;

  const ownCard = await cardModel.findById(own_id);
  if (!ownCard) {
    return next(new ErrorHandler(404, "Something Wrong with your Card"));
  }

  // Use $pull operator to remove the specified friend
  await cardModel.findByIdAndUpdate(own_id, {
    $pull: { friend_list: { friend: remove_friend_id } },
  });

  await cardModel.findByIdAndUpdate(remove_friend_id, {
    $pull: { friend_list: { friend: own_id } },
  });

  res.status(200).json({
    success: true,
    message: "Friend removed successfully",
  });
});

exports.unfriendTempCardMutualFriend = catchAsync(async (req, res, next) => {
  const { own_id, remove_friend_id } = req.body;

  const ownCard = await cardModel.findById(own_id);
  if (!ownCard) {
    return next(new ErrorHandler(404, "Your Card not found"));
  }

  // Use $pull operator to remove the specified friend
  const tempCardDelete = await tempCardModel.findByIdAndDelete(
    remove_friend_id
  );

  if (!tempCardDelete) {
    return next(
      new ErrorHandler(404, "Temporary Card not found or already deleted!")
    );
  }

  console.log(tempCardDelete);
  const email = tempCardDelete.email[0];
  // console.log(email)
  // return;

  const emailMessage = `I am sorry to delete your invitation`;

  const emailSubject = "NetWorth";
  const emailSend = await SendEmailUtils(email, emailMessage, emailSubject);

  res.status(200).json({
    success: true,
    message: "Temporary Friend removed successfully",
  });
});

exports.sendInvitationViaEmail = catchAsync(async (req, res, next) => {
  const { email, link } = req.body;

  const emailMessage = `You have been invited to join NetWorth. Please click on the following link to accept the invitation: ${link}`;
  const emailSubject = "NetWorth";
  const emailSend = await SendEmailUtils(email, emailMessage, emailSubject);

  res.status(200).json({
    success: true,
    message: "Invitation sent successfully via email",
  });

})

exports.friendViaQrCode = catchAsync(async (req, res, next) => {
  const { sender_id, receiver_id } = req.body;

  const sender = await cardModel.findById(sender_id);
  const receiver = await cardModel.findById(receiver_id);
  if (!sender) {
    return next(new ErrorHandler(404, "Sender Card not found"));
  }

  if (!receiver) {
    return next(new ErrorHandler(404, "Receiver Card not found"));
  }

  const receiverIsConnected = sender?.friend_list?.some((friend) => {
    return friend?.friend?._id?.toString() === receiver_id;
  });

  if (receiverIsConnected) {
    return res.status(200).json({
      status: true,
      message: "You are already connected with this card",
    });
  }

  const incomingRequestExists = await sender.incoming_friend_request.includes(
    receiver_id
  );

  const outgoingRequest = await sender.outgoing_friend_request.includes(
    receiver_id
  );

  if (incomingRequestExists) {
    sender.incoming_friend_request = sender.incoming_friend_request.filter(
      (id) => id.toString() !== receiver_id
    );
    receiver.outgoing_friend_request = receiver.outgoing_friend_request.filter(
      (id) => id.toString() !== sender_id
    );
    sender.friend_list.push({
      friend: receiver,
      from: "",
      time_stamp: new Date(),
    });
    receiver.friend_list.push({
      friend: sender,
      from: "",
      time_stamp: new Date(),
    });
  }else if (outgoingRequest) {
    sender.outgoing_friend_request = sender.outgoing_friend_request.filter(
      (id) => id.toString() !== receiver_id
    );
    receiver.incoming_friend_request = receiver.incoming_friend_request.filter(
      (id) => id.toString() !== sender_id
    );
    // Add receiver to sender's friend list
    sender.friend_list.push({
      friend: receiver,
      from: "",
      time_stamp: new Date(),
    });

    // Add sender to receiver's friend list
    receiver.friend_list.push({
      friend: sender,
      from: "",
      time_stamp: new Date(),
    });
  } else {
    sender.friend_list.push({
      friend: receiver,
      from: "",
      time_stamp: new Date(),
    });

    // Add sender to receiver's friend list
    receiver.friend_list.push({
      friend: sender,
      from: "",
      time_stamp: new Date(),
    });
  }

  // Save changes to sender and receiver documents
  await sender.save();
  await receiver.save();

  return res.status(200).json({
    status: true,
    message: "Friendship established successfully",
  });
});
