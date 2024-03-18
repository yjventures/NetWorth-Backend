const mongoose = require("mongoose");

const cardSchema = mongoose.Schema(
  {
    design: {
      enum: ["linear", "curved", "Tilted"],
    },
    color: {
      type: String,
    },
    name: {
      type: String,
    },
    profile_image: {
      type: String,
    },
    cover_image: {
      type: String,
    },

    bio: {
      type: String,
    },
    company_name: {
      type: String,
    },
    company_logo: {
      type: String,
    },
    email: [
      {
        type: String,
      },
    ],
    designation: {
      type: String,
    },
    phone_number: [
      {
        type: String,
      },
    ],
    links: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Link",
      },
    ],
    activities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Activity",
      },
    ],
    friend_list: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    incoming_friend_request: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    outgoing_friend_request: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    is_private: {
      type: Boolean,
    },
    is_master: {
      type: Boolean,
    },
    status: {
      type: String,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

const cardModel = mongoose.model("Card", cardSchema);

module.exports = cardModel;
