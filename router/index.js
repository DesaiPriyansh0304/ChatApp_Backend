const express = require("express");
const router = express.Router();
const authrouter = require("./auth-router");
const msgrouter = require("./mesage-router");
const mailrouter = require("./nodemailer-router");
const grouprouter = require("./Group/group-router");

router.use("/auth", authrouter);
router.use("/group", grouprouter);
router.use("/msg", msgrouter);
router.use("/otp", mailrouter);

module.exports = router;
