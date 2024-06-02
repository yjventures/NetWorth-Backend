const mongoose = require('mongoose');

const userSchema = mongoose.Schema(
  {
    email: {
      type: String,
    },
    password: {
      type: String,
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
    },
    flagged: {
      type: Boolean,
      default: false,
    },
    is_verified: {
      type: Boolean,
      default: false,
    },
    is_completed_personal_info: {
      type: Boolean,
      default: false,
    },

    personal_info: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PersonalInfo',
    },
    cards: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Card',
      },
    ],
  },
  {
    versionKey: false,
    timestamps: true,
  },
);

const userModel = mongoose.model('User', userSchema);

module.exports = userModel;
