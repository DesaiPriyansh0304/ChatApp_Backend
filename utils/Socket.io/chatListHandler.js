const ConversationHistory = require("../../model/Message-model");
const User = require("../../model/User-model");
const mongoose = require("mongoose");
const { userSocketMap } = require("./socketmap");

class ChatListHandler {
  constructor(io, socket) {
    this.io = io;
    this.socket = socket;
    this.userId = socket.handshake.query.userId;
  }

  handleGetChatList() {
    this.socket.on("getChatList", async () => {
      console.log("📋 Getting chat list for user:", this.userId);

      try {
        const userObjectId = new mongoose.Types.ObjectId(this.userId);
        const chatList = await this.fetchUserChats(userObjectId);

        // Last message time ane unread count sathe response bhejo
        this.socket.emit("chatListResponse", {
          success: true,
          chats: chatList,
          totalChats: chatList.length,
        });

        console.log(
          `✅ Chat list sent for user ${this.userId} - ${chatList.length} chats found`
        );
      } catch (error) {
        console.log("❌ Error fetching chat list:", error);
        this.socket.emit("chatListResponse", {
          success: false,
          error: "Failed to fetch chat list",
        });
      }
    });
  }

  async fetchUserChats(userObjectId) {
    try {
      // Aggregation pipeline use કરો જેથી proper data મળે
      const aggregationResult = await ConversationHistory.aggregate([
        {
          // Conversations find કરો જેમાં current user included છે
          $match: {
            $or: [
              {
                chatType: "private",
                "userIds.user": userObjectId,
              },
              {
                chatType: "group",
                "userIds.user": userObjectId,
              },
            ],
          },
        },
        {
          // User details populate કરો
          $lookup: {
            from: "users",
            let: { userIds: "$userIds.user" },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ["$_id", "$$userIds"] },
                },
              },
              {
                $project: {
                  firstname: 1,
                  lastname: 1,
                  email: 1,
                  profile_avatar: 1,
                },
              },
            ],
            as: "populatedUsers",
          },
        },
        {
          // Group details populate કરો (જો group chat છે તો)
          $lookup: {
            from: "groups",
            localField: "groupId",
            foreignField: "_id",
            as: "groupDetails",
          },
        },
        {
          // Current user માટે unread messages filter કરો
          $addFields: {
            currentUserUnreadEntry: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$unreadMessageCount",
                    cond: { $eq: ["$$this.user", userObjectId] },
                  },
                },
                0,
              ],
            },
            // Last message calculate કરો
            lastMessage: {
              $arrayElemAt: ["$messages", -1],
            },
          },
        },
        {
          // Final projection
          $project: {
            _id: 1,
            chatType: 1,
            groupId: 1,
            userIds: 1,
            populatedUsers: 1,
            groupDetails: 1,
            unreadCount: {
              $ifNull: ["$currentUserUnreadEntry.count", 0],
            },
            lastMessage: 1,
            updatedAt: 1,
            createdAt: 1,
          },
        },
        {
          // Latest conversation પહેલા
          $sort: { updatedAt: -1 },
        },
      ]);

      // console.log(
      //   "🔍 Aggregation result:",
      //   JSON.stringify(aggregationResult, null, 2)
      // );

      const chatList = [];

      for (const conversation of aggregationResult) {
        let chatData = {};

        if (conversation.chatType === "private") {
          // Private chat માટે other user અને current user find કરો
          const currentUserData = conversation.populatedUsers.find(
            (user) => user._id.toString() === userObjectId.toString()
          );
          const otherUserData = conversation.populatedUsers.find(
            (user) => user._id.toString() !== userObjectId.toString()
          );

          if (currentUserData && otherUserData) {
            // Current user ની userIds entry find કરો
            const currentUserEntry = conversation.userIds.find(
              (entry) => entry.user.toString() === userObjectId.toString()
            );
            const otherUserEntry = conversation.userIds.find(
              (entry) => entry.user.toString() !== userObjectId.toString()
            );

            chatData = {
              conversationId: conversation._id,
              chatType: "private",
              // Other user data (જેની સાથે chat છે)
              userId: otherUserData._id,
              name:
                `${otherUserData.firstname || ""} ${
                  otherUserData.lastname || ""
                }`.trim() || otherUserData.email,
              email: otherUserData.email,
              avatar: otherUserData.profile_avatar || null,
              isOnline: userSocketMap[otherUserData._id.toString()]
                ? true
                : false,
              // Current user data પણ include કરો
              currentUser: {
                userId: currentUserData._id,
                name:
                  `${currentUserData.firstname || ""} ${
                    currentUserData.lastname || ""
                  }`.trim() || currentUserData.email,
                email: currentUserData.email,
                avatar: currentUserData.profile_avatar || null,
              },
              // Both users data
              participants: [
                {
                  userId: currentUserData._id,
                  name:
                    `${currentUserData.firstname || ""} ${
                      currentUserData.lastname || ""
                    }`.trim() || currentUserData.email,
                  email: currentUserData.email,
                  avatar: currentUserData.profile_avatar || null,
                  isOnline: userSocketMap[currentUserData._id.toString()]
                    ? true
                    : false,
                  isCurrentUser: true,
                  role: currentUserEntry?.role || "member",
                },
                {
                  userId: otherUserData._id,
                  name:
                    `${otherUserData.firstname || ""} ${
                      otherUserData.lastname || ""
                    }`.trim() || otherUserData.email,
                  email: otherUserData.email,
                  avatar: otherUserData.profile_avatar || null,
                  isOnline: userSocketMap[otherUserData._id.toString()]
                    ? true
                    : false,
                  isCurrentUser: false,
                  role: otherUserEntry?.role || "member",
                },
              ],
              lastMessage: conversation.lastMessage
                ? {
                    text: conversation.lastMessage.text || "Media file",
                    type: conversation.lastMessage.type,
                    time: conversation.lastMessage.createdAt,
                    senderId: conversation.lastMessage.senderId,
                    senderName:
                      conversation.lastMessage.senderId.toString() ===
                      userObjectId.toString()
                        ? "You"
                        : `${otherUserData.firstname || ""} ${
                            otherUserData.lastname || ""
                          }`.trim() || otherUserData.email,
                  }
                : null,
              unreadCount: conversation.unreadCount,
              updatedAt: conversation.updatedAt,
            };
          }
        } else if (conversation.chatType === "group") {
          // Group chat માટે
          const groupInfo = conversation.groupDetails[0] || {};
          const totalMembers = conversation.userIds.length;

          // Current user નો role find કરો
          const currentUserEntry = conversation.userIds.find(
            (entry) => entry.user.toString() === userObjectId.toString()
          );
          const currentUserRole = currentUserEntry?.role || "member";

          // All group members ની details prepare કરો
          const members = conversation.userIds.map((entry) => {
            const userData = conversation.populatedUsers.find(
              (user) => user._id.toString() === entry.user.toString()
            );

            return {
              userId: entry.user,
              name: userData
                ? `${userData.firstname || ""} ${
                    userData.lastname || ""
                  }`.trim() || userData.email
                : "Unknown User",
              email: userData?.email || "",
              avatar: userData?.profile_avatar || null,
              role: entry.role || "member",
              addedAt: entry.addedAt,
              isOnline: userSocketMap[entry.user.toString()] ? true : false,
              isCurrentUser: entry.user.toString() === userObjectId.toString(),
            };
          });

          const onlineMembers = members.filter(
            (member) => member.isOnline
          ).length;

          chatData = {
            conversationId: conversation._id,
            chatType: "group",
            groupId: conversation.groupId,
            name: groupInfo.groupName || "Group Chat",
            avatar: groupInfo.groupAvatar || null,
            totalMembers: totalMembers,
            onlineMembers: onlineMembers,
            userRole: currentUserRole,
            // બધા members ના data
            members: members,
            // Online members ની અલગ list
            onlineMembersList: members.filter((member) => member.isOnline),
            // Admins ની list
            admins: members.filter((member) => member.role === "admin"),
            lastMessage: conversation.lastMessage
              ? {
                  text: conversation.lastMessage.text || "Media file",
                  type: conversation.lastMessage.type,
                  time: conversation.lastMessage.createdAt,
                  senderId: conversation.lastMessage.senderId,
                  senderName: (() => {
                    if (
                      conversation.lastMessage.senderId.toString() ===
                      userObjectId.toString()
                    ) {
                      return "You";
                    }
                    const sender = members.find(
                      (member) =>
                        member.userId.toString() ===
                        conversation.lastMessage.senderId.toString()
                    );
                    return sender ? sender.name : "Unknown";
                  })(),
                }
              : null,
            unreadCount: conversation.unreadCount,
            updatedAt: conversation.updatedAt,
          };
        }

        if (Object.keys(chatData).length > 0) {
          chatList.push(chatData);
        }
      }

      // Last message time પર based કરીને sort કરો
      chatList.sort((a, b) => {
        const timeA = a.lastMessage
          ? new Date(a.lastMessage.time)
          : new Date(a.updatedAt);
        const timeB = b.lastMessage
          ? new Date(b.lastMessage.time)
          : new Date(b.updatedAt);
        return timeB - timeA; // Latest પહેલા
      });

      console.log("✅ Final chat list prepared:", chatList.length, "chats");
      return chatList;
    } catch (error) {
      console.log("❌ Error in fetchUserChats:", error);
      throw error;
    }
  }

  // Real-time chat list update માટે
  static async updateChatListForUsers(io, conversationId, affectedUserIds) {
    try {
      console.log("🔄 Updating chat list for users:", affectedUserIds);

      for (const userId of affectedUserIds) {
        const userSocket = userSocketMap[userId];
        if (userSocket) {
          const userObjectId = new mongoose.Types.ObjectId(userId);
          const chatListHandler = new ChatListHandler(io, {
            handshake: { query: { userId } },
            emit: (event, data) => io.to(userSocket).emit(event, data),
          });

          const chatList = await chatListHandler.fetchUserChats(userObjectId);

          io.to(userSocket).emit("chatListUpdated", {
            success: true,
            chats: chatList,
            totalChats: chatList.length,
            updatedAt: new Date(),
          });

          console.log(`✅ Chat list updated for user ${userId}`);
        }
      }
    } catch (error) {
      console.log("❌ Error updating chat list:", error);
    }
  }
}

module.exports = ChatListHandler;
