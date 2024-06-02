const jwt = require('jsonwebtoken');

exports.verifyRefresh = async (refreshToken) => {
  try {
    let refreshTokenKey = refreshToken.split(' ')[1];

    // Verify the refresh token using the correct secret key
    const decoded = jwt.verify(refreshTokenKey, process.env.JWT_REFRESH_SECRET);

    // Check if the token is not expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.iat && decoded.exp && decoded.exp > currentTime) {
      return { valid: true, userId: decoded.userId };
    } else {
      return { valid: false };
    }
  } catch (error) {
    return { valid: false };
  }
};
