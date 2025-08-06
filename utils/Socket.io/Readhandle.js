const ConversationHistory = require("../../model/Message-model");
const mongoose = require("mongoose");
const UnreadCountService = require("./Unreadmessage");

class ReadReceiptsHandler {
  constructor(io, socket) {
    this.io = io;
    this.socket = socket;
    this.userId = socket.handshake.query.userId;
  }

  handleMarkAsRead() {
    this.socket.on("markAsRead", async (data) => {
      console.log("👀 Mark as read request:", data);

      try {
        const { senderId, receiverId, messageId } = data;
        const userObjectId = new mongoose.Types.ObjectId(this.userId);
        const senderObjectId = new mongoose.Types.ObjectId(senderId);

        // Find private conversation
        let conversation = await ConversationHistory.findOne({
          chatType: "private",
          userIds: {
            $all: [
              { $elemMatch: { user: userObjectId } },
              { $elemMatch: { user: senderObjectId } },
            ],
          },
        });

        if (!conversation) {
          console.log("❌ Conversation not found");
          return;
        }

        if (messageId) {
          // Mark specific message as read
          const messageObjectId = new mongoose.Types.ObjectId(messageId);
          const message = conversation.messages.find((msg) =>
            msg.messageId.equals(messageObjectId)
          );

          if (message && !message.seenBy.includes(userObjectId)) {
            message.seenBy.push(userObjectId);
            console.log(
              `✅ Message ${messageId} marked as read by ${this.userId}`
            );
          }
        } else {
          // Mark all messages as read for this user
          conversation.messages.forEach((message) => {
            if (!message.seenBy.includes(userObjectId)) {
              message.seenBy.push(userObjectId);
            }
          });
          console.log(`✅ All messages marked as read by ${this.userId}`);
        }

        // Reset unread count for this user
        const previousCount = UnreadCountService.resetUnreadCount(
          conversation,
          userObjectId
        );

        // Save conversation
        await conversation.save();
        console.log("💾 Read status and unread count saved");

        // Emit read receipt to sender
        const senderSocketId = require("./socketmap").userSocketMap[senderId];
        if (senderSocketId) {
          this.io.to(senderSocketId).emit("messageRead", {
            messageId: messageId || "all",
            readBy: this.userId,
            conversationId: conversation._id,
          });
        }
        UnreadCountService.resetUnreadCount(conversation, userObjectId);
        UnreadCountService.removeUnreadMessages(conversation, userObjectId);
        await conversation.save();

        // Emit updated unread count to current user
        this.socket.emit("unreadCountUpdated", {
          conversationId: conversation._id,
          newCount: 0,
          previousCount,
        });
      } catch (error) {
        console.error("❌ Error marking message as read:", error);
      }
    });
  }

  handleMarkGroupAsRead() {
    this.socket.on("markGroupAsRead", async (data) => {
      console.log("👀 Mark group message as read:", data);

      try {
        const { groupId, messageId } = data;
        const userObjectId = new mongoose.Types.ObjectId(this.userId);

        // Find group conversation
        let conversation = await ConversationHistory.findOne({
          chatType: "group",
          groupId: new mongoose.Types.ObjectId(groupId),
        });

        if (!conversation) {
          console.log("❌ Group conversation not found");
          return;
        }

        if (messageId) {
          // Mark specific message as read
          const messageObjectId = new mongoose.Types.ObjectId(messageId);
          const message = conversation.messages.find((msg) =>
            msg.messageId.equals(messageObjectId)
          );

          if (message && !message.seenBy.includes(userObjectId)) {
            message.seenBy.push(userObjectId);
            console.log(
              `✅ Group message ${messageId} marked as read by ${this.userId}`
            );
          }
        } else {
          // Mark all messages as read for this user
          conversation.messages.forEach((message) => {
            if (!message.seenBy.includes(userObjectId)) {
              message.seenBy.push(userObjectId);
            }
          });
          console.log(`✅ All group messages marked as read by ${this.userId}`);
        }

        // Reset unread count for this user
        const previousCount = UnreadCountService.resetUnreadCount(
          conversation,
          userObjectId
        );

        // Save conversation
        await conversation.save();
        console.log("💾 Group read status and unread count saved");

        // Emit to group members that message was read
        this.socket.to(groupId).emit("groupMessageRead", {
          messageId: messageId || "all",
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
      } catch (error) {
        console.error("❌ Error marking group message as read:", error);
      }
    });
  }
}

module.exports = ReadReceiptsHandler;
