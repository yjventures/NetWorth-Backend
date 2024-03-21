//basic lib inport
const express = require("express");
const router = require("./src/route/api");
const app = new express();

const { connectToDB } = require("./src/config/dbConnection");

//security middleware lib import
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const cors = require("cors");
const { errorMiddleware } = require("./src/middleware/errorMiddleware");



//security middleware implement
app.use(helmet());
app.use(express.json());
app.use(cors());
app.use(mongoSanitize());


//database connection
connectToDB();

// logger middleware
app.use((req, res, next) => {
  req.time = new Date(Date.now()).toString();
  res.on("finish", function () {
    console.log(
      req.method,
      req.hostname,
      req.path,
      res.statusCode,
      res.statusMessage,
      req.time
    );
  });
  next();
});

//routing implement
app.use("/api/v1", router);

//undefined route Implement
app.use("*", (req, res) => {
  res.status(404).json({
    status: false,
    message: "Route Not Found",
  });
});


//error handler middleware
app.use(errorMiddleware);

module.exports = app;
