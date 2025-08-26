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

    this.socket.emit("getOnlineUsers", Object.keys(userSocketMap));

    // ✅ User connect થયા પછી તેના બધા groups માં auto-join કરાવો
    this.autoJoinUserGroups();
  }

  // ✅ નવું function: User ના બધા groups માં automatically join કરાવવા માટે
  async autoJoinUserGroups() {
    try {
      console.log(`🔄 Auto-joining user ${this.userId} to their groups...`);

      const userObjectId = new mongoose.Types.ObjectId(this.userId);

      // User ના બધા group conversations find કરો
      const userGroups = await ConversationHistory.find({
        chatType: "group",
        "userIds.user": userObjectId,
      }).select("groupId groupName");

      console.log(
        `📋 Found ${userGroups.length} groups for user ${this.userId}`
      );

      // બધા groups માં join કરાવો
      for (const group of userGroups) {
        const groupId = group.groupId.toString();
        this.socket.join(groupId);
        console.log(
          `✅ User ${this.userId} auto-joined group ${groupId} (${
            group.groupName || "Unnamed Group"
          })`
        );
      }

      if (userGroups.length > 0) {
        console.log(
          `🎯 User ${this.userId} successfully joined ${userGroups.length} groups`
        );
      }
    } catch (error) {
      console.error(`❌ Error auto-joining user groups:`, error);
    }
  }

  handleChatOpen() {
    // ✅ OpenChat event ને openChatWith માં rename કર્યું consistency માટે
    this.socket.on("openChatWith", async (data) => {
      console.log("📂 Chat opened:", data);

      try {
        const { userId, chatWithUserId, groupId, chatType } = data;

        if (chatType === "private" && chatWithUserId) {
          // Private chat opened
          openedChats[this.userId] = chatWithUserId;
          console.log(
            `👤 User ${this.userId} opened private chat with ${chatWithUserId}`
          );

          // Auto-mark messages as read when chat is opened
          await this.markPrivateMessagesAsRead(chatWithUserId);
        } else if (chatType === "group" && groupId) {
          // Group chat opened
          openedChats[this.userId] = groupId;
          console.log(`👥 User ${this.userId} opened group chat ${groupId}`);

          // Join group room (if not already joined)
          if (!this.socket.rooms.has(groupId)) {
            this.socket.join(groupId);
            console.log(`✅ User ${this.userId} joined group room ${groupId}`);
          }

          // Auto-mark group messages as read when chat is opened
          await this.markGroupMessagesAsRead(groupId);
        }

        // Debug socket states
        UnreadCountService.debugSocketStates();
      } catch (error) {
        console.error("❌ Error handling chat open:", error);
      }
    });

    // Backward compatibility માટે openChat event પણ રાખો
    this.socket.on("openChat", async (data) => {
      console.log("📂 Legacy openChat event received:", data);
      // Convert to new format and handle
      const convertedData = {
        userId: this.userId,
        chatWithUserId: data.receiverId,
        groupId: data.groupId,
        chatType: data.chatType,
      };

      // Re-emit as openChatWith
      this.socket.emit("openChatWith", convertedData);
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

        // Remove unread messages for this user
        UnreadCountService.removeUnreadMessages(conversation, userObjectId);

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

        // Remove unread messages for this user
        UnreadCountService.removeUnreadMessages(conversation, userObjectId);

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
    this.socket.on("joinGroup", (data) => {
      // ✅ Data object અથવા direct groupId handle કરો
      const groupId = typeof data === "object" ? data.groupId : data;

      if (groupId) {
        this.socket.join(groupId);
        console.log(`👥 User ${this.userId} manually joined group ${groupId}`);
      } else {
        console.log(`❌ Invalid groupId received in joinGroup:`, data);
      }
    });

    this.socket.on("leaveGroup", (data) => {
      // ✅ Data object અથવા direct groupId handle કરો
      const groupId = typeof data === "object" ? data.groupId : data;

      if (groupId) {
        this.socket.leave(groupId);
        console.log(`👥 User ${this.userId} left group ${groupId}`);

        // Remove from opened chats if this group was open
        if (openedChats[this.userId] === groupId) {
          delete openedChats[this.userId];
        }
      } else {
        console.log(`❌ Invalid groupId received in leaveGroup:`, data);
      }
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
