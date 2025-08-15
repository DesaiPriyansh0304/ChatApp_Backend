const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("db.js Connection Successfully");
  } catch (error) {
    console.log("db.js Connection failed:", error.message);
  }
};

module.exports = connectDB;
