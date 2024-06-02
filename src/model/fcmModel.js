const mongoose = require('mongoose');

const fcmSchema = mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fcm_token: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

const fcm = mongoose.model('FCM', fcmSchema);
module.exports = fcm;
