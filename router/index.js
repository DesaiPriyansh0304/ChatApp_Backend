const express = require("express");
const router = express.Router();
const authRouter = require("./auth-router");
const msgRouter = require("./mesage-router");
const mailRouter = require("./nodemailer-router");
const groupRouter = require("./Group/group-router");
const chatbotRouter = require("./Chatbot/chatbot");

router.use("/auth", authRouter);
router.use("/group", groupRouter);
router.use("/msg", msgRouter);
router.use("/otp", mailRouter);
router.use("/chat", chatbotRouter);

module.exports = router;
