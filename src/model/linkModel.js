const mongoose = require('mongoose');

const linkSchema = mongoose.Schema(
  {
    platform: {
      type: String,
    },
    link: {
      type: String,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
);

const linkModel = mongoose.model('Link', linkSchema);

module.exports = linkModel;
