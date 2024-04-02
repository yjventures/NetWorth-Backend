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

exports.searchContact = catchAsync(async (req, res, next) => {
  const { search, country, city, designation } = req.query;
  let query = {};

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
  }

  // console.log(query);

  // Execute the query
  const searchResult = await cardModel.find(query);

  res.status(200).json({
    status: true,
    data: searchResult,
  });
});

//send friend request
exports.sendConnectionRequest = catchAsync(async (req, res, next) => {
  const { sender_id, recipient_id } = req.body;
  const senderCard = await cardModel.findById(sender_id);
  const recipientCard = await cardModel.findById(recipient_id);
  //check if either user does not exist
  if (!senderCard) {
    return next(new ErrorHandler(404, "Something Wrong with Your card"));
  }

  if (!recipientCard) {
    return next(new ErrorHandler(404, "Something Wrong with Recipient Card"));
  }

  const existsInOutgoing =
    senderCard.outgoing_friend_request.includes(recipientCard);

  // console.log(existsInOutgoing);

  if (existsInOutgoing === false) {
    senderCard.outgoing_friend_request.push(recipientCard);
    recipientCard.incoming_friend_request.push(senderCard);

    const notification = await notificationModel.create({
      sender:  recipient_id,
      receiver: sender_id,
      text: "requested to connect",
    });

    recipientCard.notifications.push(notification?._id);
    await senderCard.save();
    await recipientCard.save();
  } else {
    return next(
      new ErrorHandler(402, "You Are Already Send Invitation For Connection")
    );
  }

  return res.status(200).json({
    status: true,
    message: "Connection Request Send The Card Successfully.",
  });
});

//accept connection invitation
exports.acceptConnectionRequest = catchAsync(async (req, res, next) => {
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
  const isInOutgoing =
    senderCard.outgoing_friend_request.includes(recipient_id);

  if (isInIncoming) {
    // Remove sender_id from recipientCard's incoming_friend_request
    recipientCard.incoming_friend_request =
      recipientCard.incoming_friend_request.filter(
        (id) => id.toString() !== sender_id.toString()
      );
    // Add sender_id to recipientCard's friend_list
    recipientCard.friend_list.push(sender_id);

    // Remove recipient_id from senderCard's outgoing_friend_request
    senderCard.outgoing_friend_request =
      senderCard.outgoing_friend_request.filter(
        (id) => id.toString() !== recipient_id.toString()
      );
    // Add recipient_id to senderCard's friend_list
    senderCard.friend_list.push(recipient_id);
  } else if (isInOutgoing) {
    // Remove recipient_id from senderCard's outgoing_friend_request
    senderCard.outgoing_friend_request =
      senderCard.outgoing_friend_request.filter(
        (id) => id.toString() !== recipient_id.toString()
      );
    // Add recipient_id to senderCard's friend_list
    senderCard.friend_list.push(recipient_id);

    // Remove sender_id from recipientCard's incoming_friend_request
    recipientCard.incoming_friend_request =
      recipientCard.incoming_friend_request.filter(
        (id) => id.toString() !== sender_id.toString()
      );
    // Add sender_id to recipientCard's friend_list
    recipientCard.friend_list.push(sender_id);
  } else {
    // If sender is not in either list, return an error
    return next(
      new ErrorHandler(
        404,
        "Sender not found in either incoming or outgoing requests"
      )
    );
  }

  const notification = await notificationModel.create({
    sender: sender_id,
    receiver:  recipient_id,
    text: "accepted your connection request",
  });

  senderCard.notifications.push(notification?._id)
  // Save the updated sender and recipient cards
  await senderCard.save();
  await recipientCard.save();

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
