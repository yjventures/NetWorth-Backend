const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getMessaging } = require('firebase-admin/messaging')
const fcmModel = require('../model/fcmModel')
require('dotenv').config()

initializeApp({
  credential: applicationDefault(),
  projectId: 'networthhub',
  
})

const sendMultiplePushNotification = async (user_id, message) => {
  try {
    console.log(`User id: ${user_id}`)
    console.log(`Message: ${message}`)
    const tokenCollections = await fcmModel.find({ user_id })
    if (tokenCollections) {
      const tokens = tokenCollections.map(item => {
        return item.fcm_token
      })
      const pushMessage = {
        notification: {
          body: message,
          title: 'Push Message',
        },
        tokens,
      }
      const status = await getMessaging().sendMulticast(pushMessage)
      return status
    } else {
      return false
    }
  } catch (err) {
    throw err
  }
}

const sendPushNotification = async (user_id, message, token) => {
  try {
    console.log(`User id: ${user_id}`)
    console.log(`Message: ${message}`)
    const pushMessage = {
      notification: {
        body: message,
        title: 'wasal',
      },
      token: token,
    }
    const status = await getMessaging().send(pushMessage)
    console.log('Notification sent successfully:', status)
    return status
  } catch (err) {
    console.error('Error sending notification:', err)
    throw err
  }
}

module.exports = {
  sendMultiplePushNotification,
  sendPushNotification,
}
// $env:GOOGLE_APPLICATION_CREDENTIALS="E:\Rebel Force Tech Solutions\Sonbola MVM\Sonbola-Backend\sonbola-main-firebase-adminsdk-yhc7g-9dcc6cecf6.json"
