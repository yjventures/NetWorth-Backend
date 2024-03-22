const { catchAsync } = require("../middleware/catchAsyncError");
const cardModel = require("../model/cardModel");
const personalInfoModel = require("../model/personalInfoModel");
const tempPasswordModel = require("../model/tempPasswordModel");
const userModel = require("../model/userModel");
const SendEmailUtils = require("../utils/SendEmailUtils");
const { encryptData } = require("../utils/encryptAndDecryptUtils");
const ErrorHandler = require("../utils/errorHandler");
const generator = require("generate-password");

exports.sendInvitationViaEmail = catchAsync(async (req, res, next) => {
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

exports.searchContact = catchAsync(async (req, res, next) => {
  const { name, country, city, designation, company } = req.query;
  let query = {};

  if (name) {
    query.name = { $regex: name, $options: "i" };
  }
  if (designation) {
    query.designation = { $regex: designation, $options: "i" };
  }
  if (company) {
    query.company_name = { $regex: company, $options: "i" };
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
