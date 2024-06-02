exports.errorMiddleware = (err, req, res, next) => {
  err.message = err.message || 'Internal Server Error';
  err.statusCode = err.statusCode || 500;

  if (err.code === 11000) {
    err.statusCode = err.statusCode || 500;
    err.message = 'Duplicate Key Error';
  }
  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    err.statusCode = 400;
    const messages = Object.values(err.errors).map((val) => val.message);
    err.message = messages.join('. ');
  }

  // JWT Token Expired Error
  if (err.name === 'TokenExpiredError') {
    err.statusCode = 401;
    err.message = 'Token Expired';
  }

  res.status(err.statusCode).json({
    status: false,
    message: err.message,
  });
};
