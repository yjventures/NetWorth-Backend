const mongoose = require("mongoose");
require("dotenv").config();

let URI = process.env.MONGO_URI;

exports.connectToDB = async () => {
  try {
    await mongoose.connect(URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error(err.message);
  }
};
