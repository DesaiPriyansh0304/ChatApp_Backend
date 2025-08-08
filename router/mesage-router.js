const express = require("express");
const router = express.Router();
const MessageController = require("../controller/message-controler");
const UserMiddleware = require("../middelware/User-middelware");

router.get("/user", UserMiddleware, MessageController.getuserforsilder); //get dall user get
router.get("/chat-history", MessageController.getChatHistory); //chat-history
router.get("/unredmessage", UserMiddleware, MessageController.Unreadmessage);
router.post("/mark-read", UserMiddleware, MessageController.MarkMessagesAsRead);

module.exports = router;
