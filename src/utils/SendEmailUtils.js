let nodemailer = require('nodemailer');
require('dotenv').config();
const SendEmailUtils = async (EmailTo, EmailText, EmailSubject) => {
  let transporter = nodemailer.createTransport({
    //from where to send email
    //this is for gmail, we can use yahoo mail or any smtp provider
    host: 'mail.privateemail.com',
    port: 465,
    secure: true,
    // logger: true,
    // debug: true,
    auth: {
      user: process.env.EMAIL_ADDRESS,
      pass: process.env.EMAIL_TOKEN,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });

  // send mail with defined transport object
  let mailOptions = {
    from: 'NetWorth Team <team@getnetworth.app>',
    to: EmailTo, // list of receivers
    subject: EmailSubject, // Subject line
    text: EmailText, // plain text body
  };

  //send mail
  return await transporter.sendMail(mailOptions);
};

module.exports = SendEmailUtils;
