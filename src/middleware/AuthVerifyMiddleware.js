const jwt = require("jsonwebtoken");
require("dotenv").config();

exports.authMiddleware = (req, res, next) => {
  let authorization = req.headers["authorization"];
  let token = authorization?.split(" ")[1];

  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      res.status(401).json({ status: "unauthorized" });
    } else {
      const userId = decoded["userId"];
      const role = decoded["role"];
      req.headers.userId = userId;
      req.headers.role = role;
      next();
    }
  });
};

exports.adminMiddleware = (req, res, next) => {
  let authorization = req.headers["authorization"];
  let token = authorization?.split(" ")[1];

  jwt.verify(token, process.env.ADMIN_SECRET_KEY, (err, decoded) => {
    if (err) {
      res.status(401).json({ status: "You Are Not authorized As Admin" });
    } else {
      const userId = decoded["userId"];
      const email = decoded["email"];
      const role = decoded["role"];
      if(role !== "admin"){
        res.status(401).json({ status: "You Are Not authorized As Admin" });
      }
      req.headers.userId = userId;
      req.headers.email = email;
      req.headers.role = role;
      next();
    }
  });
};
