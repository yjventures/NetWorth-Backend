const { catchAsync } = require("../middleware/catchAsyncError");
const cardModel = require("../model/cardModel");
const moment = require("moment");

exports.showAllNotifications = catchAsync(async (req, res, next) => {
  const cardId = req.params.id;

  try {
    const card = await cardModel.findById(cardId).populate({
      path: "notifications",
      model: "Notification",
      populate: {
        path: "receiver",
        model: "Card",
        select: "profile_image name",
      },
    });

    if (!card) {
      return next(new ErrorHandler(404, "Something Wrong with Card"));
    }

    const formattedNotifications = card.notifications.map(notification => ({
      ...notification.toObject(), 
      time_stamp: moment(notification.time_stamp).fromNow(), 
    }));

    return res.status(200).json({
      status: true,
      data: formattedNotifications,
    });
  } catch (error) {
    return next(new ErrorHandler(500, "Something Wrong with Card"));
  }
});
