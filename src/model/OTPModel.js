const mongoose = require('mongoose');
const OTPSchema = new mongoose.Schema({
    email: {
        type: String,
    },

    otp: {
        type: String,
    },
    //default status is 0 because we can not this otp. when we use this otp, we will change the status is 1
    //because we only one time use this otp code
    status:{
        type: Number,
        default: 0
    },
    createdDate: {
        type: Date,
        default: Date.now()
    }
},{
    versionKey: false
})

const OTPModel = mongoose.model('OTP', OTPSchema);
module.exports = OTPModel;