const mongoose = require("mongoose");

const notificationSchema = mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Card",
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Card",
    },
    text: {
      type: String,
    },
    time_stamp: {
      type: Date,
      default: Date.now,
    },
    read: {
      type: Boolean,
      default: false,
    },
    redirect_url: {
      type: String,
    }
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

const notificationModel = mongoose.model("Notification", notificationSchema);

module.exports = notificationModel;
