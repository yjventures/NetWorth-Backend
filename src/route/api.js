const express = require("express");
const router = express.Router();
const userController = require("../controller/userController");
const cardController = require("../controller/cardController");
const multer = require("multer");
const uploadImageUtils = require("../utils/uploadImageUtils");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const authVerifyMiddleware = require("../middleware/AuthVerifyMiddleware");
const adminController = require("../controller/adminController");
const connectionController = require("../controller/connectionController");

router.get("/", async (req, res, next) => {
  res.status(200).json({
    status: true,
    message: "Hello World",
  });
});
router.post("/signUp", userController.userRegistration);
router.post("/verify-email", userController.verifyRegistrationOTP);

router.post("/analyze-document", userController.analyzeDocument);

router.post("/upload", upload.single("file"), uploadImageUtils.uploadImage);

router.post("/user/login", userController.login);
// router.post("/user/verify-login", userController.verifyLoginOTP);
router.post("/user/access-token", userController.generateAccessToken);

//personal info
router.put(
  "/user/personal-info",
  authVerifyMiddleware.authMiddleware,
  userController.updatePersonalInfo
);
router.get(
  "/user/personal-info",
  authVerifyMiddleware.authMiddleware,
  userController.getPersonalInfo
);

//forgot password
router.get("/recover-verify-email/:email", userController.RecoverVerifyEmail);
router.get("/recover-verify-otp/:email/:otp", userController.recoverOTPVerify);
router.post("/recover-reset-password", userController.RecoverResetPassword);

//card
router.post(
  "/user/card",
  authVerifyMiddleware.authMiddleware,
  cardController.createCard
);
router.put(
  "/user/card/:cardId",
  authVerifyMiddleware.authMiddleware,
  cardController.updateCard
);
router.get(
  "/user/card/:cardId",
  authVerifyMiddleware.authMiddleware,
  cardController.getCardById
);
router.get(
  "/user/card",
  authVerifyMiddleware.authMiddleware,
  cardController.getAllCard
);
router.put(
  "/user/card/:cardId/activity",
  authVerifyMiddleware.authMiddleware,
  cardController.createActivity
);
router.get(
  "/user/card/:cardId/activity",
  authVerifyMiddleware.authMiddleware,
  cardController.getAllActivity
);
router.delete(
  "/user/activity/:id",
  authVerifyMiddleware.authMiddleware,
  cardController.deleteActivityByIdd
);
router.put(
  "/user/card/:cardId/link",
  authVerifyMiddleware.authMiddleware,
  cardController.createLink
);

router.get(
  "/user/card/:cardId/link",
  authVerifyMiddleware.authMiddleware,
  cardController.getAllLink
);

router.delete(
  "/user/link/:id",
  authVerifyMiddleware.authMiddleware,
  cardController.linkDeleteById
);

router.delete(
  "/user/card/:id",
  authVerifyMiddleware.authMiddleware,
  cardController.deleteCardById
);

//admin
router.post("/admin/login", adminController.adminLogin);
router.get("/admin/users", adminController.allUser);

router.get(
  "/admin/users/:userId",
  authVerifyMiddleware.adminMiddleware,
  adminController.getUserDetails
);

router.delete(
  "/admin/users/:userId",
  authVerifyMiddleware.adminMiddleware,
  adminController.deleteUser
);

router.get("/search", connectionController.searchContact);
router.post("/invite-via-email", connectionController.sendInviteViaEmail);
router.post(
  "/user/check-temp-password",
  connectionController.verifyTempPassword
);
router.put("/user/member/:id", connectionController.inviteUserRegistration);

router.put(
  "/user/card-status/:cardId",
  authVerifyMiddleware.authMiddleware,
  cardController.updateCardStatus
);

router.get(
  "/user/qr-link/:id",
  authVerifyMiddleware.authMiddleware,
  cardController.generateQRCodeLink
);

router.get(
  "/user/decrypt-link/:id",
  authVerifyMiddleware.authMiddleware,
  cardController.decryptQRCodeLink
);

router.get("/url-metadata", cardController.getMetaData);

router.get(
  "/admin/card/:id",
  authVerifyMiddleware.adminMiddleware,
  adminController.getAllFriendsListByCardId
);
module.exports = router;
