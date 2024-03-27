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

exports.sendInviteViaEmail = catchAsync(async (req, res, next) => {
  const { sender_card_id, recipient_email } = req.body;
  // console.log(req.body);

  const userEmail = await userModel.findOne({ email: recipient_email });
  const cardEmail = await cardModel.findOne({
    email: { $in: [recipient_email] },
  });
  // console.log(userEmail, cardEmail);

  const sender = await cardModel.findById(sender_card_id);
  // console.log("sender", sender)

  if (!sender) {
    return next(new ErrorHandler(401, "Your Card Is Not valid"));
  }

  if (!userEmail && !cardEmail) {
    // console.log("clicked")
    const passwordCode = generator.generate({
      length: 20,
      numbers: true,
    });

    const personalInfo = await personalInfoModel.create({
      name: "",
    });

    // Catch the new created personalinfo id
    const personalInfoId = personalInfo._id;

    // Create new user
    const newUser = await userModel.create({
      email: recipient_email,
      password: passwordCode,
      role: "user",
      personal_info: personalInfoId,
    });

    const userCount = await userModel.aggregate([
      { $match: { email: recipient_email } },
      { $count: "total" },
    ]);

    if (userCount.length > 0) {
      // Insert OTP into the database
      await tempPasswordModel.create({
        email: recipient_email,
        password: passwordCode,
      });

      const recipientEncryptId = encryptData(newUser._id.toString());
      // console.log("recipientEncryptId", recipientEncryptId);
      const url = `${process.env.INVITATION_LINK_VIA_MAIL}/${recipientEncryptId.encryptedText}`;

      console.log(url);
      const emailMessage = `You Have an Invitation Request. ${url}`;
      const emailSubject = "NetWorth";
      const emailSend = await SendEmailUtils(
        recipient_email,
        emailMessage,
        emailSubject
      );
    }
    return res
      .status(200)
      .json({ status: true, message: "Send Invitation Via Email" });
  } else if (!userEmail && cardEmail) {
    const recipientCardId = cardEmail?._id;
    // console.log(recipientCardId)
    if (!recipientCardId) {
      return next(new ErrorHandler(404, "Something wrong With Recipient Card"));
    }

    const existsInOutgoing =
      sender.outgoing_friend_request.includes(recipientCardId);
    if (!existsInOutgoing) {
      sender.outgoing_friend_request.push(recipientCardId);
    } else {
      return next(
        new ErrorHandler(402, "You Are Already Send Invitation For Connection")
      );
    }

    // sender.outgoing_friend_request.push(recipientCardId);
    cardEmail.incoming_friend_request.push(sender._id);
    await sender.save();
    await cardEmail.save();

    return res.status(200).json({
      status: true,
      message: "Send Connection Request",
    });
  } else if (userEmail && !cardEmail) {
    const userEmailWithCard = await userModel
      .findOne({ email: recipient_email })
      .populate("cards");
    // console.log(userEmailWithCard);
    if (userEmailWithCard) {
      // console.log(userEmail)
      const hasMasterCard = userEmailWithCard.cards.find(
        (card) => card.is_master === true
      );
      // console.log("hasMasterCard", hasMasterCard);

      if (hasMasterCard) {
        // console.log("sender", sender);

        const existsInOutgoing = sender.outgoing_friend_request.includes(
          hasMasterCard?._id
        );
        if (!existsInOutgoing) {
          sender.outgoing_friend_request.push(hasMasterCard?._id);
        } else {
          return next(
            new ErrorHandler(
              402,
              "You Are Already Send Invitation To The User For Connection"
            )
          );
        }

        // sender.outgoing_friend_request.push(hasMasterCard?._id);
        hasMasterCard.incoming_friend_request.push(sender._id);
        await sender.save();
        await hasMasterCard.save();

        return res.status(200).json({
          status: true,
          message: "Send Connection Request",
        });
      } else {
        return next(new ErrorHandler(404, "Main Card is Not Found"));
      }
    } else {
      return next(new ErrorHandler(404, "Something is Wrong"));
    }
  }
});

//verify temp password
exports.verifyTempPassword = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await userModel.findOne({ email: email, password: password });

  // console.log("email",email)

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  let status = 0;

  const passwordCount = await tempPasswordModel.aggregate([
    { $match: { email: email, password: password, status: status } },
    { $count: "total" },
  ]);

  if (passwordCount.length > 0) {
    await tempPasswordModel.updateOne(
      { email, password, status: status },
      { email, password, status: 1 }
    );

    return res.status(200).json({
      status: true,
      message: "temp password verified successfully.",
      data: user,
    });
  } else {
    return res.status(401).json({ status: false, message: "Invalid OTP." });
  }
});

//set new password as invited user
exports.inviteUserRegistration = catchAsync(async (req, res, next) => {
  const password = req.body.password;
  const invitedUserId = req.params.id;

  const user = await userModel.findById(invitedUserId);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const regex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@.#$!%*?&])[A-Za-z\d@.#$!%*?&]{8,15}$/;

  if (!regex.test(password)) {
    return next(
      new ErrorHandler(
        400,
        "Invalid password format. Password must have at least one lowercase letter, one uppercase letter, one digit, one special character, and be 8-15 characters long."
      )
    );
  }

  const hashedPassword = await userBcrypt.hashPassword(password);

  user.password = hashedPassword;
  user.is_verified = true;

  // Save the updated user
  await user.save();

  user.password = undefined;

  res.status(200).json({
    status: true,
    data: user,
  });
});
exports.searchContact = catchAsync(async (req, res, next) => {
  const { search, country, city, designation, } = req.query;
  let query = {};

  if (search) {
    if (search.includes('@')) {
      query.email = { $regex: `^${search}`, $options: "i" };
    } else {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
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

  console.log(existsInOutgoing)
  
  if (existsInOutgoing === false) {
    senderCard.outgoing_friend_request.push(recipientCard);
    recipientCard.incoming_friend_request.push(senderCard);

    await senderCard.save()
    await recipientCard.save()
  } else {
    return next(
      new ErrorHandler(402, "You Are Already Send Invitation For Connection")
    );
  }

  return res.status(200).json({
    status: true,
    message: "Connection Request Send The User Successfully.",
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

  const isInIncoming = recipientCard.incoming_friend_request.includes(sender_id);
  const isInOutgoing = senderCard.outgoing_friend_request.includes(recipient_id);

  if (isInIncoming) {
    // Remove sender_id from recipientCard's incoming_friend_request
    recipientCard.incoming_friend_request = recipientCard.incoming_friend_request.filter(
      id => id.toString() !== sender_id.toString()
    );
    // Add sender_id to recipientCard's friend_list
    recipientCard.friend_list.push(sender_id);

    // Remove recipient_id from senderCard's outgoing_friend_request
    senderCard.outgoing_friend_request = senderCard.outgoing_friend_request.filter(
      id => id.toString() !== recipient_id.toString()
    );
    // Add recipient_id to senderCard's friend_list
    senderCard.friend_list.push(recipient_id);
  } else if (isInOutgoing) {
    // Remove recipient_id from senderCard's outgoing_friend_request
    senderCard.outgoing_friend_request = senderCard.outgoing_friend_request.filter(
      id => id.toString() !== recipient_id.toString()
    );
    // Add recipient_id to senderCard's friend_list
    senderCard.friend_list.push(recipient_id);

    // Remove sender_id from recipientCard's incoming_friend_request
    recipientCard.incoming_friend_request = recipientCard.incoming_friend_request.filter(
      id => id.toString() !== sender_id.toString()
    );
    // Add sender_id to recipientCard's friend_list
    recipientCard.friend_list.push(sender_id);
  } else {
    // If sender is not in either list, return an error
    return next(new ErrorHandler(404, "Sender not found in either incoming or outgoing requests"));
  }

  // Save the updated sender and recipient cards
  await senderCard.save();
  await recipientCard.save();

  return res.status(200).json({
    status: true,
    message: "Connection request accepted. Users are now friends.",
  });
});


