const { userSocketMap, openedChats } = require("./socketmap");
const mongoose = require("mongoose");

class UnreadCountService {
  static handlePrivateUnreadCount(
    conversation,
    senderId,
    receiverId,
    receiverObjectId,
    normalizedMessage,
    io
  ) {
    try {
      const isReceiverOnline = userSocketMap[receiverId] !== undefined;
      const isReceiverChatOpen =
        openedChats[receiverId] === senderId.toString();

      if (isReceiverOnline && isReceiverChatOpen) {
        io.to(userSocketMap[receiverId]).emit(
          "privateMessage",
          normalizedMessage
        );
        return false;
      }

      this.increaseUnreadCount(conversation, receiverObjectId);
      this.addUnreadMessage(conversation, receiverObjectId, normalizedMessage);

      if (isReceiverOnline) {
        io.to(userSocketMap[receiverId]).emit(
          "privateMessage",
          normalizedMessage
        );
      }

      return true;
    } catch (error) {
      console.error("❌ Error in handlePrivateUnreadCount:", error);
      return false;
    }
  }

  static addUnreadMessage(conversation, userObjectId, messageData) {
    if (!Array.isArray(conversation.unreadMessages)) {
      conversation.unreadMessages = [];
    }

    conversation.unreadMessages.push({
      user: userObjectId,
      message: {
        messageId: messageData.messageId || new mongoose.Types.ObjectId(),
        senderId: messageData.senderId,
        receiverId: messageData.receiverId,
        type: messageData.type,
        content: messageData.content || [],
        text: messageData.text || "",
        fileName: messageData.fileName || [],
        fileSizes: messageData.fileSizes || [],
        createdAt: messageData.createdAt || new Date(),
      },
    });
  }

  static increaseUnreadCount(conversation, userObjectId) {
    let unreadEntry = conversation.unreadMessageCount.find((entry) =>
      entry.user.equals(userObjectId)
    );
    if (unreadEntry) unreadEntry.count += 1;
    else conversation.unreadMessageCount.push({ user: userObjectId, count: 1 });
  }

  static resetUnreadCount(conversation, userObjectId) {
    const unreadEntry = conversation.unreadMessageCount.find((entry) =>
      entry.user.equals(userObjectId)
    );
    if (unreadEntry) unreadEntry.count = 0;
  }

  static removeUnreadMessages(conversation, userObjectId) {
    conversation.unreadMessages = conversation.unreadMessages.filter(
      (entry) => !entry.user.equals(userObjectId)
    );
  }
}

module.exports = UnreadCountService;
