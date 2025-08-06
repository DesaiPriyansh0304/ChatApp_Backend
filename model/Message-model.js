const mongoose = require("mongoose");

// 📩 Message Sub-schema
const messageSubSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Private only
    type: { type: String, enum: ["text", "image", "file"], required: true },
    content: [{ type: String }],
    text: { type: String },
    fileName: [{ type: String }],
    fileSizes: [
      {
        bytes: Number,
        kb: String,
        mb: String,
      },
    ],
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// 👥 Private Chat User Sub-schema
const privateUserSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false }
);

// 👥 Group Chat User Sub-schema
const groupUserSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    addedAt: { type: Date, default: Date.now },
    role: {
      type: String,
      enum: ["admin", "subadmin", "member"],
      default: "member",
    },
  },
  { _id: false }
);

// 🗃️ Main Conversation History Schema
const conversationHistorySchema = new mongoose.Schema(
  {
    chatType: { type: String, enum: ["private", "group"], required: true },
    userIds: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    groupName: { type: String },
    messages: [messageSubSchema],
    unreadMessages: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        message: messageSubSchema,
      },
    ],
    unreadMessageCount: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        count: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "ConversationHistory",
  conversationHistorySchema
);
