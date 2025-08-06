const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: true,
    },
    lastname: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    mobile: {
      type: String,
      required: true,
    },
    dob: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    isadmin: {
      type: Boolean,
      default: false,
    },
    profile_avatar: {
      type: String,
    },
    bio: {
      type: String,
    },
    otp: {
      type: String,
    },
    otpExpiresAt: {
      type: Date,
    },
    is_Confirmed: {
      type: Boolean,
      default: false,
    },
    invitedUsers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        email: String,
        invitationMessage: { type: String },
        invited_is_Confirmed: { type: Boolean, default: false },
      },
    ],
    invitedBy: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        email: { type: String },
      },
    ],
    isFavorite: [
      {
        messageId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ConversationHistory",
        },
        chatType: {
          type: String,
          enum: ["private", "group"],
          required: true,
        },
        content: [{ type: String }],
        type: {
          type: String,
          enum: ["text", "image", "file"],
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
module.exports = User;
