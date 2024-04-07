const mongoose = require('mongoose')

const cardSchema = mongoose.Schema(
  {
    card_name: String,
    design: {
      type: String,
      enum: ['linear', 'curved', 'tilted'],
      default: 'linear',
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
    links: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Link',
      },
    ],
    activities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Activity',
      },
    ],
    friend_list: [
      {
        friend: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Card', 
        },
        from:{
          type: String,
        },
        time_stamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    incoming_friend_request: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Card',
      },
    ],
    outgoing_friend_request: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Card',
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
    notifications:[
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Notification',
      },
    ],
    count: {
      type: Number,
      default: 0
    },
    total_points: {
      type: Number,
      default: 0
    }
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

const cardModel = mongoose.model('Card', cardSchema)

module.exports = cardModel
