const mongoose = require("mongoose");

const personalInfoSchema = mongoose.Schema(
  {
    name: {
      type: String,
    },
    DOB: {
      type: String,
    },
    profile_image: {
      type: String,
    },
    cover_image: {
      type: String,
    },
    used_token: {
      type: Number,
    },
    phone_number: {
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
    designation: {
      type: String,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

const personalInfoModel = mongoose.model("PersonalInfo", personalInfoSchema);

module.exports = personalInfoModel;
