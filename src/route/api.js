const express = require("express");
const router = express.Router();
const userController = require("../controller/userController");

router.post("/signUp", userController.userRegistration);
router.post("/varify-email", userController.verifyRegistrationOTP);

router.post("/analyze-document", userController.analyzeDocument);

module.exports = router;
