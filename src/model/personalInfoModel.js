const mongoose = require('mongoose')

const personalInfoSchema = mongoose.Schema(
  {
    name: String,
    address: String,
    date_of_birth: String,
    profile_image: String,
    // cover_image: String,
    used_token: Number,
    phone_number: String,
    bio: String,
    // company_name: String,
    // company_logo: Number,
    designation: String,
    number_of_connections: Number,
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

const personalInfoModel = mongoose.model('PersonalInfo', personalInfoSchema)

module.exports = personalInfoModel
