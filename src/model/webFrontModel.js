const mongoose = require("mongoose");

// Define the variables schema
const variablesSchema = mongoose.Schema(
  {
    background: { type: String, required: true },
    foreground: { type: String, required: true },
    gray_50: { type: String, required: true },
    gray_100: { type: String, required: true },
    gray_200: { type: String, required: true },
    card: { type: String, required: true },
    card_foreground: { type: String, required: true },
    popover: { type: String, required: true },
    popover_foreground: { type: String, required: true },
    primary: { type: String, required: true },
    primary_foreground: { type: String, required: true },
    secondary: { type: String, required: true },
    secondary_foreground: { type: String, required: true },
    muted: { type: String, required: true },
    muted_foreground: { type: String, required: true },
    accent: { type: String, required: true },
    accent_foreground: { type: String, required: true },
    destructive: { type: String, required: true },
    destructive_foreground: { type: String, required: true },
    border: { type: String, required: true },
    input: { type: String, required: true },
    ring: { type: String, required: true },
  },
  { _id: false }
);

// Define the web front schema
const webFrontSchema = mongoose.Schema({
  logo: {
    defaultLogo: {
      type: String,
      required: true,
    },
    darkLogo: String,
  },
  rootPattern: {
    defaultPattern: {
      type: String,
      required: true,
    },
    darkPattern: String,
  },
  authPattern: {
    defaultPattern: {
      type: String,
      required: true,
    },
    darkPattern: String,
  },
  inboxPattern: {
    defaultPattern: {
      type: String,
      required: true,
    },
    darkPattern: String,
  },
  variables: {
    useDefaultTheme: {
      type: Boolean,
      default: true,
    },
    defaultVariables: {
      type: variablesSchema,
      required: true,
    },
    darkVariables: {
      type: variablesSchema,
      required: true,
    },
  },
  fontFamily: String,
  homepageSlider: [
    {
      image: {
        type: String,
        required: true,
      },
      text: {
        type: String,
        required: true,
      },
    },
  ],
});

const webFrontModel = mongoose.model("WebFront", webFrontSchema);
module.exports = webFrontModel;
