const mongoose = require("mongoose");

const activitySchema = mongoose.Schema(
  {
    name: {
      type: String,
    },
    start_date: {
      type: String,
    },
    end_date: {
      type: String,
    },
    currently_ongoing: {
      type: Boolean,
    },
    attachments: [
      {
        type: String,
      },
    ],
    description: {
      type: String,
    },
    link: {
      type: String,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

const activityModel = mongoose.model("activity", activitySchema);

module.exports = activityModel;
