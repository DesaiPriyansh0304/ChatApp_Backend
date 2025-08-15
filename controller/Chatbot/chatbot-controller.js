// controller/Chatbot/chatbot-controller.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API);

exports.chatbot = async (req, res) => {
  try {
    // Get message from request body
    const { message } = req.body;

    // Validate input
    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Message is required and must be a non-empty string",
      });
    }

    console.log("📩 Incoming message:", message);

    // Generate AI response using Google Gemini
    let aiResponse =
      "Sorry, I'm having trouble processing your request right now.";

    try {
      // Get the generative model - Updated to use latest model
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      // Create a prompt with some context
      const prompt = `You are a helpful AI assistant. Please respond to the following message in a friendly and informative way. Keep your response concise and helpful: "${message}"`;

      // Generate content
      const result = await model.generateContent(prompt);
      const response = await result.response;
      aiResponse = response.text();

      console.log("🤖 AI Response generated successfully");
    } catch (aiError) {
      console.error("❌ Error generating AI response:", aiError);

      // Fallback responses based on common queries
      const fallbackResponses = {
        greeting: "Hello! I'm here to help you. How can I assist you today?",
        help: "I'm an AI assistant created to help answer your questions and provide information. Feel free to ask me anything!",
        default:
          "I understand you're trying to communicate with me, but I'm having some technical difficulties right now. Please try again in a moment.",
      };

      const lowerMessage = message.toLowerCase();
      if (
        lowerMessage.includes("hello") ||
        lowerMessage.includes("hi") ||
        lowerMessage.includes("hey") ||
        lowerMessage.includes("namaste")
      ) {
        aiResponse = fallbackResponses.greeting;
      } else if (
        lowerMessage.includes("help") ||
        lowerMessage.includes("what can you do")
      ) {
        aiResponse = fallbackResponses.help;
      } else {
        aiResponse = fallbackResponses.default;
      }
    }

    // Send successful response
    res.status(200).json({
      success: true,
      data: {
        userMessage: message,
        botResponse: aiResponse,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Error in chatbot controller:", error);

    // Send error response with fallback
    res.status(500).json({
      success: false,
      error: "Internal server error. Please try again later.",
      data: {
        userMessage: req.body.message || "Unknown message",
        botResponse:
          "I apologize, but I'm experiencing technical difficulties. Please try again later.",
        timestamp: new Date().toISOString(),
      },
    });
  }
};
