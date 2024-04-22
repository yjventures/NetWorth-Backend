const { catchAsync } = require('../middleware/catchAsyncError')
const cardModel = require('../model/cardModel')
const userModel = require('../model/userModel')
const SendEmailUtils = require('../utils/SendEmailUtils')
const ErrorHandler = require('../utils/errorHandler')
const userBcrypt = require('../utils/userBcrypt')
const jwt = require('jsonwebtoken')
const generator = require('generate-password')
const personalInfoModel = require('../model/personalInfoModel')
const tempPasswordModel = require('../model/tempPasswordModel')
const { generateLinkForTeamMember } = require('../utils/encryptAndDecryptUtils')
const { encryptData, decryptData } = require('../utils/encryptAndDecryptUtils')
const aiModel = require('../model/AITokenModel')
const moment = require('moment')
const tempCardModel = require('../model/tempCardModel')

exports.adminLogin = catchAsync(async (req, res, next) => {
  const { email, password } = req.body
  if (!email || !password) {
    return next(new ErrorHandler(400, 'Email Or Password Required'))
  }
  // const adminEmail = process.env.ADMIN_EMAIL;

  // if (email !== adminEmail) {
  //   return next(new ErrorHandler(403, "You Are Not Authorized"));
  // }

  const user = await userModel.findOne({ email: email, role: 'admin' })

  const match = await userBcrypt.comparePassword(password, user.password)
  if (!match) {
    return next(new ErrorHandler(400, 'Password Is incorrect'))
  }

  const accessToken = jwt.sign(
    {
      userId: user?._id,
      email: user?.email,
      role: user?.role,
    },
    process.env.ADMIN_SECRET_KEY,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  )

  return res.status(200).json({
    success: true,
    message: 'Admin Login Successful',
    accessToken: accessToken,
  })
})

exports.allUser = catchAsync(async (req, res, next) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    let sortQuery = { createdAt: -1 }
    if (req.query.sortBy && req.query.sortOrder) {
      sortQuery[req.query.sortBy] = req.query.sortOrder === 'desc' ? -1 : 1
    }

    let filterQuery = {}
    if (req.query.search) {
      filterQuery.$or = [
        { email: { $regex: new RegExp(req.query.search, 'i') } },
        { 'personal_info.name': { $regex: new RegExp(req.query.search, 'i') } },
      ]
    }

    const totalUsers = await userModel.countDocuments(filterQuery)

    const users = await userModel
      .find(filterQuery)
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'personal_info', select: 'name profile_image' })

    if (users.length === 0) {
      return res.status(200).json({
        status: false,
        message: 'No users found',
        data: [],
      })
    }

    const totalPages = Math.ceil(totalUsers / limit)

    const responseData = {
      status: true,
      data: users,
      metaData: {
        totalUser: totalUsers,
        page: page,
        limit: limit,
        sortBy: req.query.sortBy || 'createdAt', // Default sortBy to createdAt
        sortOrder: req.query.sortOrder || 'desc', // Default sortOrder to desc
        currentPage: page,
        totalPages: totalPages,
      },
    }

    return res.status(200).json(responseData)
  } catch (error) {
    return next(error) // Pass any caught errors to the error handling middleware
  }
})

exports.getUserDetails = catchAsync(async (req, res, next) => {
  const userId = req.params.userId
  const role = req.headers.role

  if (role !== 'admin') {
    return next(new ErrorHandler(401, 'You Are Not Authorized'))
  }

  const user = await userModel
    .findById(userId)
    .populate('personal_info')
    .populate({ path: 'cards', populate: 'activities links' })

  if (!user) {
    return next(new ErrorHandler(404, 'This User Details Not Found'))
  }

  return res.status(200).json({
    status: true,
    data: user,
  })
})

exports.deleteUser = catchAsync(async (req, res, next) => {
  //  console.log("clicked")
  const userId = req.params.userId
  const role = req.headers.role

  if (role !== 'admin') {
    return next(new ErrorHandler(401, 'You Are Not Authorized'))
  }

  const user = await userModel.findByIdAndDelete(userId)

  //   console.log(user)
  if (!user) {
    return next(new ErrorHandler(404, 'This User Not Found'))
  }

  // console.log(user.email)
  const emailMessage = `Sorry, Your account has been Deleted from NetWorth Hub`
  const emailSubject = 'NetWorth'
  const emailSend = await SendEmailUtils(user.email, emailMessage, emailSubject)

  return res.status(200).json({
    status: true,
    message: 'Successfully Deleted The User',
    data: user,
  })
})

// //get all friends list by card id
exports.getAllFriendsListByCardId = catchAsync(async (req, res, next) => {
  const cardId = req.params.id
  const card = await cardModel.findById(cardId).populate('links activities friend_list')
  if (!card) {
    return next(new ErrorHandler(404, 'Something Is Wrong With This Card'))
  }

  return res.status(200).json({
    status: true,
    data: card,
  })
})

exports.addAdminTeamMember = async (req, res) => {
  const role = req.headers.role
  const reqBody = req.body
  try {
    if (role !== 'admin') {
      return res.status(200).json({
        status: 'fail',
        message: 'You are not allowed to add this team member feature',
      })
    }
    let newMemberInfo
    const passwordCode = generator.generate({
      length: 20,
      numbers: true,
    })

    const existUser = await userModel.findOne({ email: reqBody?.email })

    if (existUser) {
      return res.status(400).json({
        status: 'fail',
        message: 'user is already registered in this platform',
      })
    }

    const personalInfo = await personalInfoModel.create({
      name: reqBody.name,
    })

    const newTeamMember = await userModel.create({
      email: reqBody.email,
      // admin_role: reqBody.role,
      role: 'admin',
      password: passwordCode,
      personal_info: personalInfo?._id,
    })

    newMemberInfo = newTeamMember

    const userCount = await userModel.aggregate([{ $match: { email: reqBody.email } }, { $count: 'total' }])

    if (userCount.length > 0) {
      // Insert OTP into the database
      await tempPasswordModel.create({
        email: reqBody.email,
        password: passwordCode,
      })
      const confirmationToken = generateLinkForTeamMember(newMemberInfo.email)

      // Send a confirmation email to the user
      const emailMessage = `your temp password is  ${passwordCode} <br/> Click here to confirm your invitation as Admin: ${confirmationToken}`

      const emailSubject = 'NetworthHub System Invitation Account Confirmation'
      const emailSend = await SendEmailUtils(newMemberInfo.email, emailMessage, emailSubject)
      newMemberInfo.password = undefined
      res.status(200).json({
        status: true,
        message: 'Mail successfully sent to the invited member mail',
        data: newMemberInfo,
        emailInfo: emailSend,
      })
    }
  } catch (err) {
    console.error(err)
    res.status(500).json({ status: false, message: err.message })
  }
}

exports.checkTempPasswordAsAdmin = async (req, res) => {
  const { email, password } = req.body

  const user = await userModel.findOne({
    email: email,
    password: password,
    role: 'admin',
  })

  // console.log("email",email)

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials.' })
  }

  let status = 0
  try {
    const passwordCount = await tempPasswordModel.aggregate([
      { $match: { email: email, password: password, status: status } },
      { $count: 'total' },
    ])

    if (passwordCount.length > 0) {
      await tempPasswordModel.updateOne({ email, password, status: status }, { email, password, status: 1 })

      return res.status(200).json({
        status: true,
        message: 'temp password verified successfully.',
        data: user,
      })
    } else {
      return res.status(401).json({ message: 'Invalid OTP.' })
    }
  } catch (error) {
    console.error(error)
    return res.status(500).json({ status: false, message: error.message })
  }
}

exports.confirmMemberRegistration = async (req, res) => {
  try {
    const password = req.body.password
    const invitedUserId = req.params.invitedUserId

    const user = await userModel.findById(invitedUserId)

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@.#$!%*?&])[A-Za-z\d@.#$!%*?&]{8,15}$/

    if (!regex.test(password)) {
      return res.status(400).json({
        status: 'fail',
        message:
          'Invalid password format. Password must have at least one lowercase letter, one uppercase letter, one digit, one special character, and be 8-15 characters long.',
      })
    }

    const hashedPassword = await userBcrypt.hashPassword(password)

    user.password = hashedPassword
    user.is_verified = true
    user.is_completed_personal_info = true

    // Save the updated user
    await user.save()

    user.password = undefined

    res.status(200).json({
      status: true,
      data: user,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ status: false, message: error.message })
  }
}

exports.showAllAdmin = catchAsync(async (req, res, next) => {
  const role = req.headers.role

  if (role !== 'admin') {
    return next(new ErrorHandler(401, 'You Are Not Authorized'))
  }

  const users = await userModel.find({ role: 'admin' }).populate({ path: 'personal_info', select: 'name' })

  return res.status(200).json({
    status: true,
    data: users,
  })
})

exports.showAllStatistics = catchAsync(async (req, res, next) => {
  const role = req.headers.role

  if (role !== 'admin') {
    return next(new ErrorHandler(401, 'You Are Not Authorized'))
  }

  const filter = req.query.filter // Get the filter from query parameters

  let startDate, endDate

  // Set start and end dates based on the filter
  switch (filter) {
    case '12months':
      startDate = moment().subtract(12, 'months').startOf('day')
      endDate = moment().endOf('day')
      break
    case '30days':
      startDate = moment().subtract(30, 'days').startOf('day')
      endDate = moment().endOf('day')
      break
    case '7days':
      startDate = moment().subtract(7, 'days').startOf('day')
      endDate = moment().endOf('day')
      break
    case '24hours':
      startDate = moment().subtract(24, 'hours').startOf('hour')
      endDate = moment().endOf('hour')
      break
    case 'all': // Added "all" option
      startDate = moment(0) // Start of time
      endDate = moment().endOf('day')
      break
    default:
      // Default to showing all data
      startDate = moment(0) // Start of time
      endDate = moment().endOf('day')
  }

  // Assuming "userModel" is your User model
  const userModelLength = await userModel.countDocuments({
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
  })

  const cardModelLength = await cardModel.countDocuments({
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
  })

  const inviteInPlatForm = await tempCardModel.countDocuments({
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
  })

  const signUpCount = await cardModel.countDocuments({
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
    via_invitation: true,
  })

  res.status(200).json({
    status: 'success',
    data: {
      totalUsersCount: userModelLength,
      totalCardsCount: cardModelLength,
      invitesPlatformCount: inviteInPlatForm,
      inviteSignUpCount: signUpCount,
    },
  })
})

exports.getBarData = catchAsync(async (req, res, next) => {
  const role = req.headers.role

  if (role !== 'admin') {
    return next(new ErrorHandler(401, 'You Are Not Authorized'))
  }

  const startDate = moment().subtract(12, 'months').startOf('month') // Start 12 months ago
  const endDate = moment().endOf('month') // End of current month

  // Array to hold monthly data
  const monthlyData = []

  // Loop through each month in the range
  for (let date = startDate.clone(); date.isBefore(endDate); date.add(1, 'month')) {
    const monthStart = date.clone().startOf('month')
    const monthEnd = date.clone().endOf('month')

    const inviteInPlatFormCount = await tempCardModel.countDocuments({
      createdAt: {
        $gte: monthStart,
        $lte: monthEnd,
      },
    })

    const signUpCount = await cardModel.countDocuments({
      createdAt: {
        $gte: monthStart,
        $lte: monthEnd,
      },
      via_invitation: true,
    })

    // Format the date as "MMM DD"
    const formattedDate = date.format('MMM YY')

    // Add data for this month to the array
    monthlyData.push({
      date: formattedDate,
      inviteInPlatForm: inviteInPlatFormCount,
      signUpViaInvitation: signUpCount,
    })
  }

  res.status(200).json({
    status: false,
    data: monthlyData,
  })
})

exports.createAIToken = catchAsync(async (req, res, next) => {
  const role = req.headers.role

  if (role !== 'admin') {
    return next(new ErrorHandler(401, 'You Are Not Authorized'))
  }

  // Extract API key from the request body
  const apiKey = req.body.api_key

  const aiEncryptionKey = process.env.AI_ENCRYPTION_KEY
  // Encrypt the API key before storing it
  const hashedApiKey = encryptData(apiKey, aiEncryptionKey)

  // Create new AI token document
  const aiToken = await aiModel.create({
    token_name: req.body.token_name,
    enable_model: req.body.enable_model,
    api_key: hashedApiKey,
    max_token: req.body.max_token,
    frequency_penalty: req.body.frequency_penalty,
    temperature: req.body.temperature,
    isEnabled: req.body.isEnabled,
  })

  res.status(200).json({
    status: true,
    data: aiToken,
  })
})

exports.deleteAIToken = catchAsync(async (req, res, next) => {
  const role = req.headers.role
  const tokenId = req.params.id

  if (role !== 'admin') {
    return next(new ErrorHandler(401, 'You Are Not Authorized'))
  }

  // Create new AI token document
  const aiToken = await aiModel.findByIdAndDelete(tokenId)

  res.status(200).json({
    status: true,
    message: 'AI token deleted successfully',
    data: aiToken,
  })
})

exports.updateAIToken = catchAsync(async (req, res, next) => {
  try {
    const role = req.headers.role
    const id = req.params.id

    if (role !== 'admin') {
      return next(new ErrorHandler(401, 'You Are Not Authorized'))
    }

    const reqBody = req.body

    // Check if the request body contains the api_key field
    if (reqBody.api_key) {
      // Encrypt the new API key before updating
      const aiEncryptionKey = process.env.AI_ENCRYPTION_KEY
      reqBody.api_key = encryptData(reqBody.api_key, aiEncryptionKey)
    }

    const aiToken = await aiModel.findByIdAndUpdate(id, reqBody, {
      new: true,
    })

    if (!aiToken) {
      return next(new ErrorHandler(404, 'AI Token not found'))
    }

    res.status(200).json({
      status: true,
      data: aiToken,
    })
  } catch (error) {
    return next(error)
  }
})

exports.getToken = catchAsync(async (req, res, next) => {
  const role = req.headers.role;
  const tokenId = req.params.id
  if (role !== 'admin') {
    return next(new ErrorHandler(401, 'You Are Not Authorized'))
  }

  const aiToken = await aiModel.findById(tokenId);
  // console.log(aiToken)

  if (!aiToken) {
    return next(new ErrorHandler(404, 'AI Token not found'))
  }

  const decryptedApiKey = decryptData(
    aiToken.api_key,
    process.env.AI_ENCRYPTION_KEY
  );

  // const decryptedApiKey = decryptData(aiToken.api_key, process.env.AI_ENCRYPTION_KEY)

  // console.log(decryptedApiKey)
  // // Return a new object with decrypted api_key
  const decryptedToken = {
    ...aiToken.toJSON(),
    api_key: decryptedApiKey,
  }

  // Send the response with decrypted data and pagination metadata
  res.status(200).json({
    status: true,
    data: decryptedToken,
  });
})

exports.getAllTokens = catchAsync(async (req, res, next) => {
  const role = req.headers.role

  if (role !== 'admin') {
    return next(new ErrorHandler(401, 'You Are Not Authorized'))
  }

  // Pagination
  const page = parseInt(req.query.page) || 1
  const limit = parseInt(req.query.limit) || 10
  const skip = (page - 1) * limit

  // Sorting
  const sortBy = req.query.sortBy || 'createdAt'
  const sortOrder = req.query.sortOrder || 'desc'
  const sortOptions = {}
  sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1

  // Retrieve total count of documents
  const totalDocs = await aiModel.countDocuments()

  // Calculate total number of pages
  const totalPages = Math.ceil(totalDocs / limit)

  // Retrieve AI tokens from the database with pagination and sorting
  const aiTokens = await aiModel.find().skip(skip).limit(limit).sort(sortOptions)

  // Decrypt the api_key field for each AI token
  const decryptedTokens = aiTokens.map(aiToken => {
    // Assuming `api_key` field is encrypted and stored as a string
    const decryptedApiKey = decryptData(aiToken.api_key, process.env.AI_ENCRYPTION_KEY)
    // Return a new object with decrypted api_key
    return {
      ...aiToken.toJSON(),
      api_key: decryptedApiKey,
    }
  })

  // Send the response with decrypted data and pagination metadata
  res.status(200).json({
    status: true,
    metadata: {
      page: page,
      limit: limit,
      totalLength: totalDocs,
      totalPages: totalPages,
    },
    data: decryptedTokens,
  })
})

exports.enabledAIToken = catchAsync(async (req, res, next) => {
  try {
    const role = req.headers.role
    const id = req.params.id

    if (role !== 'admin') {
      return next(new ErrorHandler(401, 'You Are Not Authorized'))
    }

    // Update the document with the provided ID to set isEnabled to true
    const updatedToken = await aiModel.findByIdAndUpdate(
      id,
      { isEnabled: true },
      {
        new: true,
      }
    )

    // Update all other documents to set isEnabled to false
    await aiModel.updateMany({ _id: { $ne: id } }, { isEnabled: false })

    res.status(200).json({
      status: true,
      data: updatedToken,
    })
  } catch (error) {
    return next(error)
  }
})

exports.getEnabledAIToken = catchAsync(async (req, res, next) => {
  try {
    

    const enabledAIToken = await aiModel.findOne({ isEnabled: true })

    // console.log(enabledAIToken)
    if (!enabledAIToken) {
      throw new ErrorHandler(404, 'No enabled AI token found')
    }

    // Decrypt the api_key field
    const decryptedApiKey = decryptData(enabledAIToken.api_key, process.env.AI_ENCRYPTION_KEY)

    // Send the response with decrypted api_key
    res.status(200).json({
      status: true,
      data: {
        ...enabledAIToken.toJSON(),
        api_key: decryptedApiKey,
      },
    })
  } catch (error) {
    next(error)
  }
})
