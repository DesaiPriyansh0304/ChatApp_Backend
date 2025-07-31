const { userSocketMap, openedChats } = require("./socketmap");
const ConversationHistory = require("../../model/Message-model");
const UnreadCountService = require("./Unreadmessage");
const mongoose = require("mongoose");

class ConnectionHandler {
  constructor(io, socket) {
    this.io = io;
    this.socket = socket;
    this.userId = socket.handshake.query.userId;
  }

  handleConnection() {
    // User online
    userSocketMap[this.userId] = this.socket.id;
    console.log(
      `🟢 User ${this.userId} connected with socket ${this.socket.id}`
    );

    // Broadcast online status to all users
    this.socket.broadcast.emit("userOnline", {
      userId: this.userId,
      status: "online",
    });
  }

  handleChatOpen() {
    this.socket.on("openChat", async (data) => {
      console.log("📂 Chat opened:", data);

      try {
        const { receiverId, groupId, chatType } = data;

        if (chatType === "private" && receiverId) {
          // Private chat opened
          openedChats[this.userId] = receiverId;
          console.log(
            `👤 User ${this.userId} opened private chat with ${receiverId}`
          );

          // Auto-mark messages as read when chat is opened
          await this.markPrivateMessagesAsRead(receiverId);
        } else if (chatType === "group" && groupId) {
          // Group chat opened
          openedChats[this.userId] = groupId;
          console.log(`👥 User ${this.userId} opened group chat ${groupId}`);

          // Join group room
          this.socket.join(groupId);

          // Auto-mark group messages as read when chat is opened
          await this.markGroupMessagesAsRead(groupId);
        }

        // Debug socket states
        UnreadCountService.debugSocketStates();
      } catch (error) {
        console.error("❌ Error handling chat open:", error);
      }
    });

    // Handle chat close
    this.socket.on("closeChat", () => {
      console.log(`📂 User ${this.userId} closed chat`);
      delete openedChats[this.userId];
    });
  }

  async markPrivateMessagesAsRead(receiverId) {
    try {
      const userObjectId = new mongoose.Types.ObjectId(this.userId);
      const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

      // Find private conversation
      let conversation = await ConversationHistory.findOne({
        chatType: "private",
        userIds: {
          $all: [
            { $elemMatch: { user: userObjectId } },
            { $elemMatch: { user: receiverObjectId } },
          ],
        },
      });

      if (!conversation) return;

      let hasUnreadMessages = false;

      // Mark all unread messages as read
      conversation.messages.forEach((message) => {
        if (!message.seenBy.includes(userObjectId)) {
          message.seenBy.push(userObjectId);
          hasUnreadMessages = true;
        }
      });

      if (hasUnreadMessages) {
        // Reset unread count
        const previousCount = UnreadCountService.resetUnreadCount(
          conversation,
          userObjectId
        );

        // Save conversation
        await conversation.save();
        console.log(
          `✅ Private chat messages marked as read, count reset from ${previousCount} to 0`
        );

        // Emit read receipt to sender
        const receiverSocketId = userSocketMap[receiverId];
        if (receiverSocketId) {
          this.io.to(receiverSocketId).emit("messageRead", {
            messageId: "all",
            readBy: this.userId,
            conversationId: conversation._id,
          });
        }

        // Emit updated unread count to current user
        this.socket.emit("unreadCountUpdated", {
          conversationId: conversation._id,
          newCount: 0,
          previousCount,
        });
      }
    } catch (error) {
      console.error("❌ Error marking private messages as read:", error);
    }
  }

  async markGroupMessagesAsRead(groupId) {
    try {
      const userObjectId = new mongoose.Types.ObjectId(this.userId);

      // Find group conversation
      let conversation = await ConversationHistory.findOne({
        chatType: "group",
        groupId: new mongoose.Types.ObjectId(groupId),
      });

      if (!conversation) return;

      let hasUnreadMessages = false;

      // Mark all unread messages as read
      conversation.messages.forEach((message) => {
        if (!message.seenBy.includes(userObjectId)) {
          message.seenBy.push(userObjectId);
          hasUnreadMessages = true;
        }
      });

      if (hasUnreadMessages) {
        // Reset unread count
        const previousCount = UnreadCountService.resetUnreadCount(
          conversation,
          userObjectId
        );

        // Save conversation
        await conversation.save();
        console.log(
          `✅ Group chat messages marked as read, count reset from ${previousCount} to 0`
        );

        // Emit to group members that messages were read
        this.socket.to(groupId).emit("groupMessageRead", {
          messageId: "all",
          readBy: this.userId,
          groupId,
        });

        // Emit updated unread count to current user
        this.socket.emit("unreadCountUpdated", {
          conversationId: conversation._id,
          groupId,
          newCount: 0,
          previousCount,
        });
      }
    } catch (error) {
      console.error("❌ Error marking group messages as read:", error);
    }
  }

  handleGroupJoin() {
    this.socket.on("joinGroup", (groupId) => {
      this.socket.join(groupId);
      console.log(`👥 User ${this.userId} joined group ${groupId}`);
    });

    this.socket.on("leaveGroup", (groupId) => {
      this.socket.leave(groupId);
      console.log(`👥 User ${this.userId} left group ${groupId}`);
    });
  }

  handleDisconnect() {
    this.socket.on("disconnect", () => {
      console.log(`🔴 User ${this.userId} disconnected`);

      // Remove from online users
      delete userSocketMap[this.userId];

      // Remove from opened chats
      delete openedChats[this.userId];

      // Broadcast offline status
      this.socket.broadcast.emit("userOffline", {
        userId: this.userId,
        status: "offline",
      });

      console.log(`🗑️ Cleaned up data for user ${this.userId}`);
    });
  }
}

module.exports = ConnectionHandler;
