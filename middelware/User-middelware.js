const jwt = require("jsonwebtoken");

const UserMiddleware = (req, res, next) => {
  const authHeader = req.header("Authorization");
  // console.log("Incoming Auth Header:", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(400).json({
      status: 400,
      message: "Access denied. No token provided./Middwlware",
    });
  }

  const token = authHeader.split(" ")[1];
  // console.log("Token received:", token);

  try {
    if (!process.env.JWT_SECRET_KEY) {
      throw new Error("JWT_SECRET_KEY not set in environment");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    // console.log("decoded --->/Middleware", decoded);

    req.user = decoded;
    // console.log(" Final req.user -->Middleware", req.user);
    next();
  } catch (error) {
    console.log("JWT Error/Middleware:", error.message);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: 401,
        message: "Token expired/Middleware",
      });
    } else if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        status: 401,
        message: "Invalid token/Middleware",
      });
    } else {
      return res.status(500).json({
        status: 500,
        message: "Server error verifying token/Middleware",
      });
    }
  }
};

module.exports = UserMiddleware;
