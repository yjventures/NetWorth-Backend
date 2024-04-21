const mongoose = require("mongoose");

const aiSchema = mongoose.Schema(
  {
    token_name: {
      type: String,
      required: true,
    },
    enable_model: {
      type: String,
      required: true,
    },
    api_key: {
      type: String,
      required: true,
    },
    max_token: {
      type: Number,
      required: true,
    },
    frequency_penalty: {
      type: Number,
      required: true,
    },
    temperature: {
      type: Number,
      required: true,
    },
    isEnabled: {
      type: Boolean,
      required: true,
    }
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

const aiModel = mongoose.model("ai", aiSchema);

module.exports = aiModel;
