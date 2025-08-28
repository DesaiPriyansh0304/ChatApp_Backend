const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  if (!process.env.JWT_SECRET_KEY) {
    throw new Error("JWT_SECRET_KEY is not defined in Environment Variables");
  }

  return jwt.sign(
    {
      userId: user._id,
      isAdmin: user.isAdmin,
    },
    process.env.JWT_SECRET_KEY,
    { expiresIn: "7d" }
  );
};

module.exports = generateToken;
