const express = require('express')
const router = express.Router()
const userController = require('../controller/userController')
const cardController = require('../controller/cardController')
const multer = require('multer')
const uploadImageUtils = require('../utils/uploadImageUtils')
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })
const authVerifyMiddleware = require('../middleware/AuthVerifyMiddleware')
const adminController = require('../controller/adminController')
const connectionController = require('../controller/connectionController')
const tempCardController = require('../controller/tempCardController')
const { showAllNotifications } = require('../controller/notificationController')

router.get('/', async (req, res, next) => {
  res.status(200).json({
    status: true,
    message: 'Hello World',
  })
})
router.post('/signUp', userController.userRegistration)
router.post('/verify-email', userController.verifyRegistrationOTP)

router.post('/analyze-document', userController.analyzeDocument)

router.post('/upload', upload.single('file'), uploadImageUtils.uploadImage)

router.post('/user/login', userController.login)
// router.post("/user/verify-login", userController.verifyLoginOTP);
router.post('/user/access-token', userController.generateAccessToken)

//personal info
router.put('/user/personal-info', authVerifyMiddleware.authMiddleware, userController.updatePersonalInfo)
router.get('/user/personal-info', authVerifyMiddleware.authMiddleware, userController.getPersonalInfo)
router.get(
  "/admin/personal-info",
  authVerifyMiddleware.adminMiddleware,
  adminController.getAdminPersonalInfo
);

//forgot password
router.get('/recover-verify-email/:email', userController.RecoverVerifyEmail)
router.get('/recover-verify-otp/:email/:otp', userController.recoverOTPVerify)
router.post('/recover-reset-password', userController.RecoverResetPassword)

//card
router.post('/user/card', authVerifyMiddleware.authMiddleware, cardController.createCard)
router.put('/user/card/:cardId', authVerifyMiddleware.authMiddleware, cardController.updateCard)
router.get('/user/card/:cardId', authVerifyMiddleware.authMiddleware, cardController.getCardById)
router.get('/user/card', authVerifyMiddleware.authMiddleware, cardController.getAllCard)
router.put('/user/card/:cardId/activity', authVerifyMiddleware.authMiddleware, cardController.createActivity)
router.get('/user/card/:cardId/activity', cardController.getAllActivity)
router.get('/user/activity/:activityId', cardController.getSigleActivity)
router.put('/user/activity/:activityId', cardController.updateActivity)
router.delete('/user/activity/:id', authVerifyMiddleware.authMiddleware, cardController.deleteActivityByIdd)
router.put('/user/card/:cardId/link', authVerifyMiddleware.authMiddleware, cardController.createLink)

router.get('/user/card/:cardId/link', cardController.getAllLink)

router.delete('/user/link/:id', authVerifyMiddleware.authMiddleware, cardController.linkDeleteById)

router.delete('/user/card/:id', authVerifyMiddleware.authMiddleware, cardController.deleteCardById)

//admin
router.post('/admin/login', adminController.adminLogin)
router.get('/admin/users', adminController.allUser)

router.get('/admin/users/:userId', authVerifyMiddleware.adminMiddleware, adminController.getUserDetails)

router.delete('/admin/users/:userId', authVerifyMiddleware.adminMiddleware, adminController.deleteUser)

router.get('/search/:cardId', authVerifyMiddleware.authMiddleware, connectionController.searchContact)
// router.post("/invite-via-email", connectionController.sendInviteViaEmail);
// router.post(
// "/user/check-temp-password",
// connectionController.verifyTempPassword
// );
// router.put("/user/member/:id", connectionController.inviteUserRegistration);

router.put('/user/card-status/:cardId', authVerifyMiddleware.authMiddleware, cardController.updateCardStatus)

router.get('/user/qr-link/:id', authVerifyMiddleware.authMiddleware, cardController.generateQRCodeLink)

router.get('/user/decrypt-qr-link', cardController.decryptQRCodeLink)

router.get('/url-metadata', cardController.getMetaData)

router.get('/admin/card/:id', authVerifyMiddleware.adminMiddleware, adminController.getAllFriendsListByCardId)

//friend request send and acceptance
router.put('/card/send-request', authVerifyMiddleware.authMiddleware, connectionController.sendConnectionRequest)
router.put('/card/accept-request', authVerifyMiddleware.authMiddleware, connectionController.acceptConnectionRequest)

router.put(
  '/card/cancel-incoming-request',
  authVerifyMiddleware.authMiddleware,
  connectionController.cancelIncomingRequest
)

router.put(
  '/card/cancel-outgoing-request',
  authVerifyMiddleware.authMiddleware,
  connectionController.cancelOutgoingRequest
)

router.get(
  '/card/:id/incoming-request',
  authVerifyMiddleware.authMiddleware,
  connectionController.showInComingRequestList
)

router.get(
  '/card/:id/outgoing-request',
  authVerifyMiddleware.authMiddleware,
  connectionController.showOutGoingRequestList
)

//show feed
router.get('/card/:id/feed', authVerifyMiddleware.authMiddleware, cardController.showAllActivities)
router.get('/card/:id/friend-list', authVerifyMiddleware.authMiddleware, cardController.showFriendListForCard)

router.post('/user/invitation/temp-card', authVerifyMiddleware.authMiddleware, tempCardController.createTempCard)

router.get('/check-temp-invitation', tempCardController.decryptTempCardInvitation)

router.post('/invitation/card', authVerifyMiddleware.authMiddleware, tempCardController.createNewCard)

router.get('/user/check-card/card/:cardId', authVerifyMiddleware.authMiddleware, cardController.checkCardOwner)

router.get('/card/:id/notifications', authVerifyMiddleware.authMiddleware, showAllNotifications)

router.put('/get-visitor-count', cardController.countTotalVisitior)
router.get('/card/analyze-data/:id', cardController.cardAnalyticalData)
router.get(
  '/card/get-unread-notification/:id',
  // authVerifyMiddleware.authMiddleware,
  connectionController.countUnreadNotifications
)
router.get(
  '/card/get-unread-notification-id/:id',
  // authVerifyMiddleware.authMiddleware,
  connectionController.getUnreadNotificationIds
)

router.put(
  '/card/set-notification-read/:id',
  authVerifyMiddleware.authMiddleware,
  connectionController.markNotificationsAsRead
)
router.put('/admin/add-admin', authVerifyMiddleware.adminMiddleware, adminController.addAdminTeamMember)
router.post('/admin/check-temp-password', adminController.checkTempPasswordAsAdmin)

router.put('/admin/member/:invitedUserId', adminController.confirmMemberRegistration)

router.get('/admin/team-member', authVerifyMiddleware.adminMiddleware, adminController.showAllAdmin)

router.get('/admin/statistics', authVerifyMiddleware.adminMiddleware, adminController.showAllStatistics)

router.get('/admin/dashboard-bar-data', authVerifyMiddleware.adminMiddleware, adminController.getBarData)

router.post('/admin/ai', authVerifyMiddleware.adminMiddleware, adminController.createAIToken)
router.delete('/admin/ai/:id', authVerifyMiddleware.adminMiddleware, adminController.deleteAIToken)
router.get('/admin/ai/:id', authVerifyMiddleware.adminMiddleware, adminController.getToken)
router.put('/admin/ai/:id', authVerifyMiddleware.adminMiddleware, adminController.updateAIToken)
router.get('/admin/ai', authVerifyMiddleware.adminMiddleware, adminController.getAllTokens)
router.put('/admin/ai/enabled/:id', authVerifyMiddleware.adminMiddleware, adminController.enabledAIToken)
router.get('/user/ai/get-enabled-token',authVerifyMiddleware.authMiddleware, adminController.getEnabledAIToken)
router.put('/user/change-password', authVerifyMiddleware.authMiddleware, userController.changePassword)
router.get(
  "/user/average-point",
  authVerifyMiddleware.authMiddleware,
  userController.averagePointData
);
router.get("/users/rankings", authVerifyMiddleware.authMiddleware, userController.topRankings);
router.put(
  "/admin/personal-info",
  authVerifyMiddleware.adminMiddleware,
  adminController.updateAAdminPersonalInfo
);

router.get(
  "/admin/signup-statistic",
  authVerifyMiddleware.adminMiddleware,
  adminController.targetSignupStatistic
);

router.get(
  "/card/check-friend",
  connectionController.checkCardInFriendListOrNot
);

router.put(
  "/card/invitation-card-initialization",
  authVerifyMiddleware.authMiddleware,
  connectionController.cardIniatializationFormInvitation
);

router.put("/card/unfriend", connectionController.unfriendMutualFriend);
router.put("/card/temp-card-unfriend", connectionController.unfriendTempCardMutualFriend);

router.post(
  "/invitation/via-email",
  authVerifyMiddleware.authMiddleware,
  connectionController.sendInvitationViaEmail
);

router.put(
  "/connection-via-qr",
  authVerifyMiddleware.authMiddleware,
  connectionController.friendViaQrCode
);
module.exports = router
