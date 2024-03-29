const mongoose = require("mongoose");

const tempCardSchema = mongoose.Schema(
  {
    name: {
      type: String,
    },
    company_name: {
      type: String,
    },
    address: String,
    email: [
      {
        type: String,
        unique: true,
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
    invited_card: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Card",
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

const tempCardModel = mongoose.model("TempCard", tempCardSchema);

module.exports = tempCardModel;
