// middelware/Chatbot-middelware.js
const validateChatbotRequest = (req, res, next) => {
  const { message } = req.body;

  // Check if message exists
  if (!message) {
    return res.status(400).json({
      success: false,
      error: "Message field is required",
    });
  }

  // Check if message is a string
  if (typeof message !== "string") {
    return res.status(400).json({
      success: false,
      error: "Message must be a string",
    });
  }

  // Check message length
  if (message.length > 1000) {
    return res.status(400).json({
      success: false,
      error: "Message too long. Maximum 1000 characters allowed.",
    });
  }

  // Check if message is just whitespace
  if (message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Message cannot be empty",
    });
  }

  next();
};

module.exports = { validateChatbotRequest };
