const { catchAsync } = require('../middleware/catchAsyncError')
const cardModel = require('../model/cardModel')
const personalInfoModel = require('../model/personalInfoModel')
const tempPasswordModel = require('../model/tempPasswordModel')
const userModel = require('../model/userModel')
const SendEmailUtils = require('../utils/SendEmailUtils')
const { encryptData } = require('../utils/encryptAndDecryptUtils')
const ErrorHandler = require('../utils/errorHandler')
const generator = require('generate-password')
const userBcrypt = require('../utils/userBcrypt')
const notificationModel = require('../model/notificationModel')

exports.searchContact = catchAsync(async (req, res, next) => {
  const { search, country, city, designation } = req.query
  let query = {}

  if (search) {
    if (search.includes('@')) {
      query.email = { $regex: `^${search}`, $options: 'i' }
    } else {
      query.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }]
    }
  }

  if (designation) {
    query.designation = { $regex: designation, $options: 'i' }
  }

  // For city and country
  if (city && country) {
    const cityRegex = new RegExp(city, 'i')
    const countryRegex = new RegExp(country, 'i')
    query.address = {
      $regex: `${cityRegex.source}.*${countryRegex.source}`,
      $options: 'i',
    }
  } else if (city) {
    const cityRegex = new RegExp(city, 'i')
    query.address = {
      $regex: cityRegex.source,
      $options: 'i',
    }
  } else if (country) {
    const countryRegex = new RegExp(country, 'i')
    query.address = {
      $regex: countryRegex.source,
      $options: 'i',
    }
  }

  // console.log(query);

  // Execute the query
  const searchResult = await cardModel.find(query)

  res.status(200).json({
    status: true,
    data: searchResult,
  })
})

//send friend request
exports.sendConnectionRequest = catchAsync(async (req, res, next) => {
  const { sender_id, recipient_id } = req.body

  // Find the sender and recipient cards
  const senderCard = await cardModel.findById(sender_id)
  const recipientCard = await cardModel.findById(recipient_id)

  // Check if either user does not exist
  if (!senderCard) {
    return next(new ErrorHandler(404, 'Sender card not found'))
  }

  if (!recipientCard) {
    return next(new ErrorHandler(404, 'Recipient card not found'))
  }

  // Check if the recipient is already in the sender's outgoing_friend_request
  const existsInOutgoing = senderCard.outgoing_friend_request.some(card => card.toString() === recipient_id.toString())

  if (!existsInOutgoing) {
    // Check if sender or recipient is already connected
    const senderIsConnected = senderCard.friend_list.some(
      friend => friend.friend.toString() === recipient_id.toString()
    )
    const recipientIsConnected = recipientCard.friend_list.some(
      friend => friend.friend.toString() === sender_id.toString()
    )

    if (senderIsConnected || recipientIsConnected) {
      return next(new ErrorHandler(403, 'You are already connected with this user.'))
    }

    // Add recipientCard to sender's outgoing_friend_request
    senderCard.outgoing_friend_request.push(recipientCard)

    // Add senderCard to recipient's incoming_friend_request
    recipientCard.incoming_friend_request.push(senderCard)

    // Create notification
    const notification = await notificationModel.create({
      sender: sender_id,
      receiver: recipient_id,
      text: 'requested to connect',
      redirect_url: `${process.env.NOTIFICATION_REDIRECT_URL}/${sender_id}?from=incoming_request`,
    })

    // Add notification to recipient's notifications
    recipientCard.notifications.push(notification._id)

    // Save changes to both cards
    await senderCard.save()
    await recipientCard.save()
  } else {
    // If already exists in outgoing_friend_request, return an error
    return next(new ErrorHandler(403, 'You have already sent a connection request to this user.'))
  }

  return res.status(200).json({
    status: true,
    message: 'Connection request sent successfully.',
  })
})

//accept connection invitation
exports.acceptConnectionRequest = catchAsync(async (req, res, next) => {
  const { recipient_id, sender_id } = req.body
  const senderCard = await cardModel.findById(sender_id)
  const recipientCard = await cardModel.findById(recipient_id)

  if (!senderCard) {
    return next(new ErrorHandler(404, 'Something Wrong with Sender Card'))
  }

  if (!recipientCard) {
    return next(new ErrorHandler(404, 'Something Wrong with Your Card'))
  }

  const isInIncoming = recipientCard.incoming_friend_request.includes(sender_id)
  const isInOutgoing = senderCard.outgoing_friend_request.includes(recipient_id)

  if (isInIncoming) {
    // Remove sender_id from recipientCard's incoming_friend_request
    recipientCard.incoming_friend_request = recipientCard.incoming_friend_request.filter(
      id => id.toString() !== sender_id.toString()
    )

    // Add sender_id to recipientCard's friend_list with a timestamp
    recipientCard.friend_list.push({
      friend: sender_id,
      from: 'incoming',
      time_stamp: new Date(),
    })

    // Remove recipient_id from senderCard's outgoing_friend_request
    senderCard.outgoing_friend_request = senderCard.outgoing_friend_request.filter(
      id => id.toString() !== recipient_id.toString()
    )

    // Add recipient_id to senderCard's friend_list with a timestamp
    senderCard.friend_list.push({
      friend: recipient_id,
      time_stamp: new Date(),
    })
  } else if (isInOutgoing) {
    // Remove recipient_id from senderCard's outgoing_friend_request
    senderCard.outgoing_friend_request = senderCard.outgoing_friend_request.filter(
      id => id.toString() !== recipient_id.toString()
    )

    // Add recipient_id to senderCard's friend_list with a timestamp
    senderCard.friend_list.push({
      friend: recipient_id,
      time_stamp: new Date(),
    })

    // Remove sender_id from recipientCard's incoming_friend_request
    recipientCard.incoming_friend_request = recipientCard.incoming_friend_request.filter(
      id => id.toString() !== sender_id.toString()
    )

    // Add sender_id to recipientCard's friend_list with a timestamp
    recipientCard.friend_list.push({
      friend: sender_id,
      time_stamp: new Date(),
    })
  } else {
    // If sender is not in either list, return an error
    return next(new ErrorHandler(404, 'Sender not found in either incoming or outgoing requests'))
  }

  // Increment points for receiver and sender
  const pointsForReceiver = 250
  const pointsForSender = 150

  recipientCard.total_points += pointsForReceiver
  senderCard.total_points += pointsForSender

  const notification = await notificationModel.create({
    sender: sender_id,
    receiver: recipient_id,
    text: 'accepted your connection request',
    redirect_url: `${process.env.NOTIFICATION_REDIRECT_URL}/${recipient_id}?from=outgoing_request`,
  })

  senderCard.notifications.push(notification?._id)

  // Save the updated sender and recipient cards
  await senderCard.save()
  await recipientCard.save()

  return res.status(200).json({
    status: true,
    message: 'Connection request accepted. Users are now friends.',
  })
})

//show incoming request
exports.showInComingRequestList = catchAsync(async (req, res, next) => {
  const id = req.params.id

  const incomingRequest = await cardModel.findById(id).populate({
    path: 'incoming_friend_request',
    model: 'Card',
  }).select(`
    -outgoing_friend_request 
    -friend_list
    -address
    -bio
    -card_name
    -color
    -company_logo
    -company_name
    -cover_image
    -designation
    -name
    -profile_image
    -design -email -phone_number -links -activities
  `)

  if (!incomingRequest) {
    return next(new ErrorHandler(200, 'Something is Wrong With Card Incoming Request'))
  }

  return res.status(200).json({
    status: true,
    data: incomingRequest,
  })
})

//show out going request
exports.showOutGoingRequestList = catchAsync(async (req, res, next) => {
  const id = req.params.id

  const outgoingRequest = await cardModel.findById(id).populate({
    path: 'outgoing_friend_request',
    model: 'Card',
  }).select(`
    -incoming_friend_request 
    -friend_list
    -address
    -bio
    -card_name
    -color
    -company_logo
    -company_name
    -cover_image
    -designation
    -name
    -profile_image
    -design -email -phone_number -links -activities
  `)

  if (!outgoingRequest) {
    return next(new ErrorHandler(200, 'Something is Wrong With Card outgoing Request'))
  }

  return res.status(200).json({
    status: true,
    data: outgoingRequest,
  })
})

//cancel incoming connection request
exports.cancelIncomingRequest = catchAsync(async (req, res, next) => {
  const { recipient_id, sender_id } = req.body
  const senderCard = await cardModel.findById(sender_id)
  const recipientCard = await cardModel.findById(recipient_id)

  if (!senderCard) {
    return next(new ErrorHandler(404, 'Something Wrong with Sender Card'))
  }

  if (!recipientCard) {
    return next(new ErrorHandler(404, 'Something Wrong with Your Card'))
  }

  const isInIncoming = recipientCard.incoming_friend_request.includes(sender_id)

  if (isInIncoming) {
    recipientCard.incoming_friend_request = recipientCard.incoming_friend_request.filter(
      id => id.toString() !== sender_id.toString()
    )
    senderCard.outgoing_friend_request = senderCard.outgoing_friend_request.filter(
      id => id.toString() !== recipient_id.toString()
    )
  } else {
    return next(new ErrorHandler(404, 'Sender not found in either incoming or outgoing requests'))
  }

  // Save the updated sender and recipient cards
  await senderCard.save()
  await recipientCard.save()

  return res.status(200).json({
    status: true,
    message: 'Connection Request Cancelled',
  })
})

//cancel outgoing connection request
exports.cancelOutgoingRequest = catchAsync(async (req, res, next) => {
  const { recipient_id, sender_id } = req.body
  const senderCard = await cardModel.findById(sender_id)
  const recipientCard = await cardModel.findById(recipient_id)

  if (!senderCard) {
    return next(new ErrorHandler(404, 'Something Wrong with Sender Card'))
  }

  if (!recipientCard) {
    return next(new ErrorHandler(404, 'Something Wrong with Your Card'))
  }

  const isInOutgoing = senderCard.outgoing_friend_request.includes(recipient_id)

  if (isInOutgoing) {
    senderCard.outgoing_friend_request = senderCard.outgoing_friend_request.filter(
      id => id.toString() !== recipient_id.toString()
    )

    // Remove sender_id from recipientCard's incoming_friend_request
    recipientCard.incoming_friend_request = recipientCard.incoming_friend_request.filter(
      id => id.toString() !== sender_id.toString()
    )
  } else {
    return next(new ErrorHandler(404, 'Sender not found in either incoming or outgoing requests'))
  }

  // Save the updated sender and recipient cards
  await senderCard.save()
  await recipientCard.save()

  return res.status(200).json({
    status: true,
    message: 'Connection Request Cancelled',
  })
})

exports.countUnreadNotifications = catchAsync(async (req, res, next) => {
  const id = req.params.id

  try {
    const card = await cardModel.findById(id).populate('notifications')
    if (!card) {
      return next(new ErrorHandler(404, 'Card not found'))
    }

    // Filter notifications where read is false
    const unreadNotifications = card.notifications.filter(notification => notification.read === false)

    // console.log(unreadNotifications)
    const unreadCount = unreadNotifications.length

    return res.status(200).json({
      status: true,
      data: {
        unreadCount,
      },
    })
  } catch (error) {
    return next(new ErrorHandler(500, 'Internal Server Error'))
  }
})

exports.getUnreadNotificationIds = catchAsync(async (req, res, next) => {
  const id = req.params.id

  try {
    const card = await cardModel.findById(id).populate('notifications')
    if (!card) {
      return next(new ErrorHandler(404, 'Card not found'))
    }

    // Filter notifications where read is false and extract their _id values
    const unreadNotificationIds = card.notifications
      .filter(notification => !notification.read)
      .map(notification => notification._id)

    return res.status(200).json({
      status: true,
      data: unreadNotificationIds,
    })
  } catch (error) {
    return next(new ErrorHandler(500, 'Internal Server Error'))
  }
})

exports.markNotificationsAsRead = catchAsync(async (req, res, next) => {
  const { notificationIds } = req.body

  try {
    // Check if notificationIds array is provided
    if (!notificationIds || !Array.isArray(notificationIds)) {
      return next(new ErrorHandler(400, 'Notification IDs array is required'))
    }

    // Update notifications with provided IDs to set read field to true
    await notificationModel.updateMany({ _id: { $in: notificationIds } }, { $set: { read: true } })

    return res.status(200).json({
      status: true,
      message: 'Notifications marked as read successfully',
    })
  } catch (error) {
    return next(new ErrorHandler(500, error))
  }
})
