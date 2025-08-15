const express = require("express");
const router = express.Router();
const ChatbotController = require("../../controller/Chatbot/chatbot-controller");
const {
  validateChatbotRequest,
} = require("../../middelware/Chatbot-middelware");

router.post("/bot", validateChatbotRequest, ChatbotController.chatbot);

module.exports = router;
