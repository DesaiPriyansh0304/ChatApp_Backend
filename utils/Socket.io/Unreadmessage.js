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

  // ✅ FIXED: Group unread count handler with proper user handling
  static handleGroupUnreadCount(
    conversation,
    senderId,
    groupId,
    normalizedMessage,
    io
  ) {
    try {
      console.log("📊 Handling group unread count for group:", groupId);

      conversation.userIds.forEach((userObj) => {
        try {
          let userId = null;
          let userObjectId = null;

          if (!userObj) {
            console.log("⚠️ Found undefined userObj in handleGroupUnreadCount");
            return;
          }

          // Try different ways to extract userId and userObjectId
          if (userObj.user) {
            // If user field exists (ObjectId or string)
            if (typeof userObj.user === "string") {
              userId = userObj.user;
              userObjectId = new mongoose.Types.ObjectId(userObj.user);
            } else if (userObj.user.toString) {
              userId = userObj.user.toString();
              userObjectId = userObj.user;
            }
          } else if (userObj._id) {
            // If it's a direct user object with _id
            if (typeof userObj._id === "string") {
              userId = userObj._id;
              userObjectId = new mongoose.Types.ObjectId(userObj._id);
            } else if (userObj._id.toString) {
              userId = userObj._id.toString();
              userObjectId = userObj._id;
            }
          } else if (typeof userObj === "string") {
            // If it's just a string userId
            userId = userObj;
            userObjectId = new mongoose.Types.ObjectId(userObj);
          } else if (
            userObj.toString &&
            typeof userObj.toString === "function"
          ) {
            // If it's an ObjectId directly - but check if it's actually an ObjectId
            const stringValue = userObj.toString();
            if (stringValue !== "[object Object]") {
              userId = stringValue;
              userObjectId = userObj;
            }
          }

          if (!userId || userId === "[object Object]" || !userObjectId) {
            console.log(
              "⚠️ Could not extract valid userId from userObj in handleGroupUnreadCount:",
              userObj
            );
            return;
          }

          // Skip sender
          if (userId === senderId) {
            console.log(`🚫 Skipping sender for unread count: ${userId}`);
            return;
          }

          const isUserOnline = userSocketMap[userId] !== undefined;
          const isGroupChatOpen = openedChats[userId] === groupId;

          console.log(
            `👤 User ${userId} - Online: ${isUserOnline}, Chat Open: ${isGroupChatOpen}`
          );

          // જો user online છે અને group chat open છે તો unread count ન વધારો
          if (!isUserOnline || !isGroupChatOpen) {
            this.increaseUnreadCount(conversation, userObjectId);
            this.addUnreadMessage(
              conversation,
              userObjectId,
              normalizedMessage
            );

            console.log(`📊 Increased unread count for user: ${userId}`);
          }
        } catch (innerError) {
          console.error(
            "❌ Error processing userObj in handleGroupUnreadCount:",
            userObj,
            innerError
          );
        }
      });

      return true;
    } catch (error) {
      console.error("❌ Error in handleGroupUnreadCount:", error);
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
        groupId: messageData.groupId, // ✅ Group ID add કર્યું
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
    if (unreadEntry) {
      unreadEntry.count += 1;
    } else {
      conversation.unreadMessageCount.push({ user: userObjectId, count: 1 });
    }
  }

  static resetUnreadCount(conversation, userObjectId) {
    const unreadEntry = conversation.unreadMessageCount.find((entry) =>
      entry.user.equals(userObjectId)
    );
    if (unreadEntry) {
      const previousCount = unreadEntry.count;
      unreadEntry.count = 0;
      return previousCount;
    }
    return 0;
  }

  static removeUnreadMessages(conversation, userObjectId) {
    conversation.unreadMessages = conversation.unreadMessages.filter(
      (entry) => !entry.user.equals(userObjectId)
    );
  }

  // ✅ Debug helper function
  static debugSocketStates() {
    console.log("🔍 Socket Debug Info:");
    console.log("Online users:", Object.keys(userSocketMap));
    console.log("Opened chats:", openedChats);
  }
}

module.exports = UnreadCountService;
