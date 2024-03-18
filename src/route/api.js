const express = require('express')
const router = express.Router()
const userController = require('../controller/userController')
const multer = require('multer')
const uploadImageUtils = require('../utils/uploadImageUtils')
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })
const authVerifyMiddleware = require('../middleware/AuthVerifyMiddleware')

router.post('/signUp', userController.userRegistration)
router.post('/verify-email', userController.verifyRegistrationOTP)

router.post('/analyze-document', userController.analyzeDocument)

router.post('/upload', upload.single('file'), uploadImageUtils.uploadImage)

router.post('/user/login', userController.login)
router.post('/user/verify-login', userController.verifyLoginOTP)
router.post('/user/access-token', userController.generateAccessToken)
router.put('/user/personal-info', authVerifyMiddleware.authMiddleware, userController.updatePersonalInfo)
router.get('/user/personal-info', authVerifyMiddleware.authMiddleware, userController.getPersonalInfo)
module.exports = router
