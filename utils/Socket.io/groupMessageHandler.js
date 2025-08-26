const ConversationHistory = require("../../model/Message-model");
const mongoose = require("mongoose");
const { userSocketMap, openedChats } = require("./socketmap");
const { uploadFiles } = require("./fileUploader");
const UnreadCountService = require("./Unreadmessage");
const ChatListHandler = require("./chatListHandler");

const processedMessages = new Map();

class GroupMessageHandler {
  constructor(io, socket) {
    this.io = io;
    this.socket = socket;
    this.userId = socket.handshake.query.userId;
  }

  handleGroupMessage() {
    this.socket.on("groupMessage", async (data) => {
      console.log("📩 Group message data received:", data);

      const {
        groupId,
        senderId,
        groupName,
        textMessage,
        base64Image = [],
        base64File = [],
        messageType,
        fileName = [],
        fileNames = [],
      } = data;

      try {
        const senderObjectId = new mongoose.Types.ObjectId(senderId);
        const groupObjectId = new mongoose.Types.ObjectId(groupId);

        // ✅ Handle file names safely
        const finalFileNames =
          Array.isArray(fileName) && fileName.length > 0
            ? fileName
            : Array.isArray(fileNames)
            ? fileNames
            : [];

        // ✅ Handle image and file arrays safely
        const sanitizedBase64Image = Array.isArray(base64Image)
          ? base64Image
          : [];
        const sanitizedBase64File = Array.isArray(base64File) ? base64File : [];

        // Duplicate message check
        const messageHash = this.generateMessageHash(data);
        if (processedMessages.has(messageHash)) {
          console.log("🚫 Duplicate message detected, ignoring:", messageHash);
          return;
        }

        processedMessages.set(messageHash, Date.now());
        this.cleanupProcessedMessages();

        const conversation = await ConversationHistory.findOne({
          chatType: "group",
          groupId: groupObjectId,
        });

        if (!conversation) {
          return this.socket.emit("error", { message: "Group not found" });
        }

        // Check user permission
        if (!this.checkUserPermission(conversation, senderId)) {
          return this.socket.emit("error", {
            message: "Not allowed to send messages",
          });
        }

        const { contentUrls } = await uploadFiles({
          base64Image: sanitizedBase64Image,
          base64File: sanitizedBase64File,
          textMessage,
          fileName: finalFileNames,
        });

        const messageId = new mongoose.Types.ObjectId();
        const message = {
          messageId: messageId, // ✅ messageId field add કર્યું
          senderId: senderObjectId,
          groupId: groupObjectId, // ✅ groupId message માં add કર્યું
          groupName,
          type: messageType,
          content: contentUrls,
          fileName: finalFileNames.length > 0 ? finalFileNames : undefined,
          text: textMessage || undefined,
          seenBy: [senderObjectId],
          createdAt: new Date(),
        };

        const normalizedMessage = {
          ...message,
          messageId: messageId.toString(),
          senderId: senderObjectId.toString(), // ✅ String format માં convert કર્યું
          groupId: groupObjectId.toString(), // ✅ String format માં convert કર્યું
          image: messageType === "image" ? contentUrls[0] : "",
          file: messageType === "file" ? contentUrls[0] : "",
          isGroupMessage: true, // ✅ Group message flag add કર્યું
        };

        // Save message to database
        conversation.messages.push(message);
        await conversation.save();
        console.log("💾 Message saved to database successfully");

        // ✅ પહેલા બધા group members ને properly join કરાવો
        await this.ensureGroupMembersJoined(conversation, groupId);

        // ✅ Real-time emission with proper socket rooms
        await this.emitToGroupMembers(
          conversation,
          normalizedMessage,
          senderId,
          groupId
        );

        // ✅ Unread count handle કરો (હવે function available છે)
        UnreadCountService.handleGroupUnreadCount(
          conversation,
          senderId,
          groupId,
          normalizedMessage,
          this.io
        );

        // Save conversation again with unread counts
        await conversation.save();

        // 🆕 Chat list update કરો બધા group members માટે - FIXED
        const affectedUserIds = [];
        conversation.userIds.forEach((userObj) => {
          try {
            let userId = null;

            if (!userObj) {
              return;
            }

            // Try different ways to extract userId
            if (userObj.user) {
              if (typeof userObj.user === "string") {
                userId = userObj.user;
              } else if (userObj.user.toString) {
                userId = userObj.user.toString();
              }
            } else if (userObj._id) {
              if (typeof userObj._id === "string") {
                userId = userObj._id;
              } else if (userObj._id.toString) {
                userId = userObj._id.toString();
              }
            } else if (typeof userObj === "string") {
              userId = userObj;
            } else if (
              userObj.toString &&
              typeof userObj.toString === "function"
            ) {
              const stringValue = userObj.toString();
              if (stringValue !== "[object Object]") {
                userId = stringValue;
              }
            }

            if (userId && userId !== "[object Object]") {
              affectedUserIds.push(userId);
            }
          } catch (error) {
            console.error(
              "❌ Error extracting userId for chat list update:",
              userObj,
              error
            );
          }
        });

        await ChatListHandler.updateChatListForUsers(
          this.io,
          conversation._id,
          affectedUserIds
        );

        console.log("✅ Group message processing completed successfully");
      } catch (error) {
        console.error("⚫ Error in groupMessage:", error);
        this.socket.emit("error", { message: "Failed to send message" });
      }
    });
  }

  // ✅ FIXED: Group members ને socket rooms માં join કરાવવા માટે
  async ensureGroupMembersJoined(conversation, groupId) {
    console.log("🔄 Ensuring all group members are joined to room:", groupId);

    conversation.userIds.forEach((userObj) => {
      try {
        // Handle different user object structures
        let userId = null;

        if (!userObj) {
          console.log("⚠️ Found undefined userObj in ensureGroupMembersJoined");
          return;
        }

        // Try different ways to extract userId
        if (userObj.user) {
          // If user field exists (ObjectId or string)
          if (typeof userObj.user === "string") {
            userId = userObj.user;
          } else if (userObj.user.toString) {
            userId = userObj.user.toString();
          }
        } else if (userObj._id) {
          // If it's a direct user object with _id
          if (typeof userObj._id === "string") {
            userId = userObj._id;
          } else if (userObj._id.toString) {
            userId = userObj._id.toString();
          }
        } else if (typeof userObj === "string") {
          // If it's just a string userId
          userId = userObj;
        } else if (userObj.toString && typeof userObj.toString === "function") {
          // If it's an ObjectId directly - but check if it's actually an ObjectId
          const stringValue = userObj.toString();
          if (stringValue !== "[object Object]") {
            userId = stringValue;
          }
        }

        if (!userId || userId === "[object Object]") {
          console.log(
            "⚠️ Could not extract valid userId from userObj:",
            userObj
          );
          return;
        }

        const userSocketId = userSocketMap[userId];

        if (userSocketId) {
          // Get socket instance from io
          const userSocket = this.io.sockets.sockets.get(userSocketId);
          if (userSocket && !userSocket.rooms.has(groupId)) {
            userSocket.join(groupId);
            console.log(`✅ User ${userId} joined group room ${groupId}`);
          }
        } else {
          console.log(`👤 User ${userId} is not online, skipping room join`);
        }
      } catch (error) {
        console.error(
          "❌ Error in ensureGroupMembersJoined for userObj:",
          userObj,
          error
        );
      }
    });
  }

  // ✅ FIXED: emitToGroupMembers function with proper user handling
  async emitToGroupMembers(conversation, message, senderId, groupId) {
    let sentCount = 0;
    let onlineMembers = [];
    let offlineMembers = [];

    console.log("📤 Starting group message emission...");

    // પહેલા check કરો કે કેટલા members online છે
    conversation.userIds.forEach((userObj) => {
      try {
        // Handle different user object structures
        let userId = null;

        if (!userObj) {
          console.log("⚠️ Found undefined userObj in emitToGroupMembers");
          return;
        }

        // Try different ways to extract userId
        if (userObj.user) {
          // If user field exists (ObjectId or string)
          if (typeof userObj.user === "string") {
            userId = userObj.user;
          } else if (userObj.user.toString) {
            userId = userObj.user.toString();
          }
        } else if (userObj._id) {
          // If it's a direct user object with _id
          if (typeof userObj._id === "string") {
            userId = userObj._id;
          } else if (userObj._id.toString) {
            userId = userObj._id.toString();
          }
        } else if (typeof userObj === "string") {
          // If it's just a string userId
          userId = userObj;
        } else if (userObj.toString && typeof userObj.toString === "function") {
          // If it's an ObjectId directly - but check if it's actually an ObjectId
          const stringValue = userObj.toString();
          if (stringValue !== "[object Object]") {
            userId = stringValue;
          }
        }

        if (!userId || userId === "[object Object]") {
          console.log(
            "⚠️ Could not extract valid userId from userObj:",
            userObj
          );
          return;
        }

        if (userId === senderId) {
          console.log(`🚫 Skipping sender: ${userId}`);
          return;
        }

        const userSocketId = userSocketMap[userId];

        if (userSocketId) {
          onlineMembers.push(userId);
        } else {
          offlineMembers.push(userId);
        }
      } catch (error) {
        console.error(
          "❌ Error processing userObj in emitToGroupMembers:",
          userObj,
          error
        );
      }
    });

    console.log(
      `👥 Group members status - Online: ${onlineMembers.length}, Offline: ${offlineMembers.length}`
    );

    // Method 1: Socket rooms use કરીને emit કરો (preferred)
    try {
      this.io.to(groupId).emit("groupMessage", {
        ...message,
        roomEmission: true, // Debug માટે flag
      });

      console.log(`📡 Message emitted to group room: ${groupId}`);

      // પણ individual emission પણ કરો backup માટે
      onlineMembers.forEach((userId) => {
        const userSocketId = userSocketMap[userId];

        if (userSocketId) {
          this.io.to(userSocketId).emit("groupMessage", {
            ...message,
            recipientId: userId,
            individualEmission: true, // Debug માટે flag
          });
          sentCount++;
          console.log(`📤 Individual message sent to user: ${userId}`);
        }
      });

      // Offline members ને database માં store કર્યું હતું
      offlineMembers.forEach((userId) => {
        console.log(`👤 User ${userId} is offline, message stored in DB`);
      });
    } catch (emitError) {
      console.error("❌ Error emitting to group:", emitError);
    }

    console.log(
      `✅ Group message emitted to ${sentCount} members (excluding sender)`
    );
  }

  generateMessageHash(data) {
    const { groupId, senderId, textMessage, messageType } = data;
    const timestamp = Date.now();
    return `${groupId}_${senderId}_${textMessage}_${messageType}_${Math.floor(
      timestamp / 1000
    )}`;
  }

  cleanupProcessedMessages() {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [hash, timestamp] of processedMessages.entries()) {
      if (timestamp < fiveMinutesAgo) {
        processedMessages.delete(hash);
      }
    }
  }

  // ✅ FIXED: checkUserPermission method with proper error handling
  checkUserPermission(conversation, senderId) {
    try {
      // Validate inputs
      if (!conversation || !conversation.userIds || !senderId) {
        console.log("❌ Invalid inputs for permission check");
        return false;
      }

      console.log("🔍 Checking permission for senderId:", senderId);
      console.log("👥 Group userIds:", conversation.userIds);

      const userInGroup = conversation.userIds.find((u) => {
        // Handle both ObjectId and string formats
        if (!u) {
          console.log("⚠️ Found undefined user in group");
          return false;
        }

        // Handle different user object structures
        let userId;

        if (u.user) {
          // If user field exists (ObjectId or string)
          userId = typeof u.user === "string" ? u.user : u.user.toString();
        } else if (u._id) {
          // If it's a direct user object with _id
          userId = typeof u._id === "string" ? u._id : u._id.toString();
        } else if (typeof u === "string") {
          // If it's just a string userId
          userId = u;
        } else if (u.toString) {
          // If it's an ObjectId directly
          userId = u.toString();
        } else {
          console.log("⚠️ Unrecognized user format:", u);
          return false;
        }

        const match = userId === senderId;
        if (match) {
          console.log("✅ User found in group:", userId);
        }
        return match;
      });

      if (!userInGroup) {
        console.log("❌ User not found in group");
        return false;
      }

      // Check role permissions
      const allowedRoles = ["admin", "subadmin", "member"];
      const userRole = userInGroup.role || "member"; // Default to member if no role

      const hasPermission = allowedRoles.includes(userRole);
      console.log(
        `🔑 User role: ${userRole}, Has permission: ${hasPermission}`
      );

      return hasPermission;
    } catch (error) {
      console.error("❌ Error in checkUserPermission:", error);
      return false;
    }
  }
}

module.exports = GroupMessageHandler;
