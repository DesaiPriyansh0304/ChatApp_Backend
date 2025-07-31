const ConversationHistory = require("../../model/Message-model");
const mongoose = require("mongoose");
const { userSocketMap, openedChats } = require("./socketmap");
const { uploadFiles, convertSizes } = require("./fileUploader");
const UnreadCountService = require("./Unreadmessage");

class PrivateMessageHandler {
  constructor(io, socket) {
    this.io = io;
    this.socket = socket;
    this.userId = socket.handshake.query.userId;
  }

  handlePrivateMessage() {
    this.socket.on("privateMessage", async (data) => {
      console.log("📩 Received from frontend: /PRIVATE MESSAGE", data);

      try {
        const {
          senderId,
          receiverId,
          textMessage,
          base64Image = [],
          base64File = [],
          messageType,
          fileName = [],
        } = data;

        const senderObjectId = new mongoose.Types.ObjectId(senderId);
        const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

        // File/Image upload
        const { contentUrls, rawSizes, uploadedFileNames } = await uploadFiles({
          base64Image,
          base64File,
          textMessage,
          fileName,
        });

        const convertedSizes = convertSizes(rawSizes);

        // Find or create private conversation
        let conversation = await this.findOrCreateConversation(
          senderObjectId,
          receiverObjectId
        );

        const message = {
          senderId: senderObjectId,
          receiverId: receiverObjectId,
          type: messageType,
          content: contentUrls,
          fileName:
            uploadedFileNames.length > 0 ? uploadedFileNames : undefined,
          fileSizes: convertedSizes,
          text: textMessage || undefined,
          seenBy: [senderObjectId],
          createdAt: new Date(),
        };

        const normalizedMessage = {
          ...message,
          image: messageType === "image" ? contentUrls : "",
          file: messageType === "file" ? contentUrls : "",
        };

        // Message save કરો
        conversation.messages.push(message);

        // Handle unread count and message delivery
        const countIncreased = UnreadCountService.handlePrivateUnreadCount(
          conversation,
          senderId,
          receiverId,
          receiverObjectId,
          normalizedMessage,
          this.io
        );

        // ⚠️ IMPORTANT: Save conversation AFTER unread count changes
        await conversation.save();
        console.log("💾 Message and unread count saved in DB");

        // Sender ને message emit કરો
        this.socket.emit("privateMessage", normalizedMessage);
      } catch (err) {
        console.error("❌ Error saving private message:", err);
      }
    });
  }

  async findOrCreateConversation(senderObjectId, receiverObjectId) {
    let conversation = await ConversationHistory.findOne({
      chatType: "private",
      userIds: {
        $all: [
          { $elemMatch: { user: senderObjectId } },
          { $elemMatch: { user: receiverObjectId } },
        ],
      },
    });

    if (!conversation) {
      conversation = new ConversationHistory({
        chatType: "private",
        userIds: [{ user: senderObjectId }, { user: receiverObjectId }],
        messages: [],
        unreadMessageCount: [],
      });
    }

    return conversation;
  }
}

module.exports = PrivateMessageHandler;
