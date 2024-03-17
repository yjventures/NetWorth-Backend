const express = require("express");
const router = express.Router();
const userController = require("../controller/userController");
const multer = require("multer");
const uploadImageUtils = require("../utils/uploadImageUtils");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


router.post("/signUp", userController.userRegistration);
router.post("/varify-email", userController.verifyRegistrationOTP);

router.post("/analyze-document", userController.analyzeDocument);

router.post("/upload", upload.single("file"), uploadImageUtils.uploadImage);

router.post("/user/login", userController.login);
router.post("/user/varify-login", userController.verifyLoginOTP);
router.post("/user/access-token", userController.generateAccessToken)

module.exports = router;
