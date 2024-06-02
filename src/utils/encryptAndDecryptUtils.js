const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const base64url = require('base64url');
require('dotenv').config();

// Encrypt data
exports.encryptData = (text, key) => {
  // console.log("text", text)
  const encrypted = CryptoJS.AES.encrypt(text, key).toString();
  console.log('return data', encrypted);
  return base64url(encrypted);
};

// Decryption function
exports.decryptData = (encryptedText, key) => {
  const decrypted = CryptoJS.AES.decrypt(base64url.decode(encryptedText), key).toString(CryptoJS.enc.Utf8);
  return decrypted;
};

exports.generateLinkForTeamMember = (email) => {
  const confirmationLink = `${process.env.INVITATION_REDIRECT_URL}/first-login?email=${email}`;
  return confirmationLink;
};
