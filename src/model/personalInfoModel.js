const mongoose = require('mongoose')

const personalInfoSchema = mongoose.Schema(
  {
    name: {
      type: String,
    },
    date_of_birth: {
      type: String,
    },
    profile_image: {
      type: String,
    },
    // cover_image: {
    //   type: String,
    // },
    used_token: {
      type: Number,
    },
    phone_number: {
      type: String,
    },
    bio: {
      type: String,
    },
    // company_name: {
    //   type: String,
    // },
    // company_logo: {
    //   type: Number,
    // },
    designation: {
      type: String,
    },
    number_of_connections: {
      type: Number,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

const personalInfoModel = mongoose.model('PersonalInfo', personalInfoSchema)

module.exports = personalInfoModel
