const User = require("../model/User-model");
const MessageModel = require("../model/Message-model");
const mongoose = require("mongoose");
const { Types } = mongoose;

exports.getuserforsilder = async (req, res) => {
  try {
    const userId = req.user.userId;
    // console.log("userId --->/getuserforsilder/senderID", userId);

    if (!userId) {
      res.status(400).json({ message: "UserId is not Provided" });
    }

    const filterdUsers = await User.find({ _id: { $ne: userId } }).select(
      "-password"
    );
    // console.log("filterdUsers --->/getuserforsilder", filterdUsers);

    const unseenMessages = {};
    // console.log("unseenMessages --->/getuserforsilder", unseenMessages); ///null object give me

    // Declare promises first before using them
    const promises = filterdUsers.map(async (user) => {
      const message = await MessageModel.find({
        senderId: user._id,
        receiverId: userId,
        seen: false,
      });
      if (message.length > 0) {
        unseenMessages[user._id] = message.length;
      }
    });

    // console.log("senderId --->/getuserforsilder", senderId); //senderId is not defined
    // console.log("receiverId --->/getuserforsilder", receiverId); //userid give me
    // console.log("seen --->/getuserforsilder", seen);

    // You can now safely log after declaration
    // console.log("promises array created");

    await Promise.all(promises);

    res
      .status(201)
      .json({ success: true, users: filterdUsers, unseenMessages });
  } catch (error) {
    console.log(error.message, "getuserforsilder");
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getChatHistory = async (req, res) => {
  try {
    const { userId1, userId2, groupId, page = 1, searchText = "" } = req.query;
    const pageSize = 10;
    const pageNumber = parseInt(page);
    const userSelectFields =
      "firstname lastname email profile_avatar bio gender dob";

    if (!groupId && (!userId1 || !userId2)) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    let chat;

    if (groupId) {
      // Group chat
      chat = await MessageModel.findOne({
        chatType: "group",
        groupId: groupId,
      })
        .populate({
          path: "messages.senderId",
          select: userSelectFields,
        })
        .populate({
          path: "messages.receiverId",
          select: userSelectFields,
        });

      if (!chat) {
        return res.status(404).json({
          success: false,
          message: "No chat history found",
        });
      }

      // 🔧 Manually fetch user details
      const groupUsers = await Promise.all(
        chat.userIds.map(async (entry) => {
          const userData = await User.findById(entry.user, userSelectFields);
          return {
            user: userData || {},
            role: entry.role,
            addedAt: entry.addedAt,
          };
        })
      );

      // 🔍 Filter and sort
      let filteredMessages = chat.messages;

      if (searchText.trim()) {
        const lowerSearch = searchText.toLowerCase();
        filteredMessages = filteredMessages.filter((msg) =>
          msg.content?.toLowerCase().includes(lowerSearch)
        );
      }

      const sortedMessages = filteredMessages.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      const totalMessages = sortedMessages.length;
      const totalPages = Math.ceil(totalMessages / pageSize);
      const paginatedMessages = sortedMessages
        .slice((pageNumber - 1) * pageSize, pageNumber * pageSize)
        .reverse();

      const cleanMessages = paginatedMessages.map((msg) => ({
        ...msg.toObject(),
        senderId: msg.senderId?._id || msg.senderId,
        receiverId: msg.receiverId?._id || msg.receiverId,
      }));

      return res.json({
        success: true,
        currentPage: pageNumber,
        totalPages,
        totalMessages,
        chatHistory: cleanMessages,
        groupUsers,
      });
    } else {
      // Private chat
      const userId1Obj = new Types.ObjectId(userId1);
      const userId2Obj = new Types.ObjectId(userId2);

      chat = await MessageModel.findOne({
        chatType: "private",
        userIds: {
          $all: [
            { $elemMatch: { user: userId1Obj } },
            { $elemMatch: { user: userId2Obj } },
          ],
        },
      })
        .populate({
          path: "messages.senderId",
          select: userSelectFields,
        })
        .populate({
          path: "messages.receiverId",
          select: userSelectFields,
        });

      if (!chat) {
        return res.status(404).json({
          success: false,
          message: "No chat history found",
        });
      }

      // 🔍 Filter and sort
      let filteredMessages = chat.messages;

      if (searchText.trim()) {
        const lowerSearch = searchText.toLowerCase();
        filteredMessages = filteredMessages.filter((msg) =>
          msg.content?.toLowerCase().includes(lowerSearch)
        );
      }

      const sortedMessages = filteredMessages.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      const totalMessages = sortedMessages.length;
      const totalPages = Math.ceil(totalMessages / pageSize);
      const paginatedMessages = sortedMessages
        .slice((pageNumber - 1) * pageSize, pageNumber * pageSize)
        .reverse();

      const firstMsg = chat.messages.find((m) => m.senderId && m.receiverId);
      const sender = firstMsg?.senderId || null;
      const receiver = firstMsg?.receiverId || null;

      const cleanMessages = paginatedMessages.map((msg) => ({
        ...msg.toObject(),
        senderId: msg.senderId?._id || msg.senderId,
        receiverId: msg.receiverId?._id || msg.receiverId,
      }));

      return res.json({
        success: true,
        currentPage: pageNumber,
        totalPages,
        totalMessages,
        chatHistory: cleanMessages,
        sender,
        receiver,
      });
    }
  } catch (error) {
    console.error("Chat history error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// exports.Unreadmessage = async (req, res) => {
//   try {
//     const userId = new mongoose.Types.ObjectId(req.user._id);
//     console.log("🔍 Searching for userId:", userId);

//     // First, let's get raw data to see what exists
//     const rawConversations = await MessageModel.find({
//       chatType: "private",
//       "userIds.user": userId,
//     }).lean();

//     console.log("🔍 Found conversations:", rawConversations.length);

//     if (rawConversations.length === 0) {
//       return res.status(200).json({
//         message: "No conversations found for this user",
//         userId: userId,
//       });
//     }

//     // Log first conversation structure
//     console.log("🔍 First conversation structure:");
//     console.log("  - _id:", rawConversations[0]._id);
//     console.log("  - userIds:", rawConversations[0].userIds);
//     console.log(
//       "  - unreadMessageCount:",
//       rawConversations[0].unreadMessageCount
//     );
//     console.log(
//       "  - unreadMessages length:",
//       rawConversations[0].unreadMessages?.length || 0
//     );

//     // Simple aggregation without complex filtering
//     const conversations = await MessageModel.aggregate([
//       {
//         $match: {
//           chatType: "private",
//           "userIds.user": userId,
//         },
//       },
//       {
//         $addFields: {
//           otherUserId: {
//             $first: {
//               $filter: {
//                 input: "$userIds",
//                 as: "uid",
//                 cond: { $ne: ["$$uid.user", userId] },
//               },
//             },
//           },
//         },
//       },
//       {
//         $lookup: {
//           from: "users",
//           localField: "otherUserId.user",
//           foreignField: "_id",
//           as: "user",
//         },
//       },
//       { $unwind: "$user" },
//       {
//         $project: {
//           user: {
//             _id: 1,
//             firstname: 1,
//             lastname: 1,
//             email: 1,
//             profile_avatar: 1,
//           },
//           // Show raw unread data for debugging
//           rawUnreadMessageCount: "$unreadMessageCount",
//           rawUnreadMessages: "$unreadMessages",
//           // Calculate unread count
//           unreadMessageCount: {
//             $let: {
//               vars: {
//                 userCount: {
//                   $arrayElemAt: [
//                     {
//                       $filter: {
//                         input: "$unreadMessageCount",
//                         as: "item",
//                         cond: { $eq: ["$$item.user", userId] },
//                       },
//                     },
//                     0,
//                   ],
//                 },
//               },
//               in: { $ifNull: ["$$userCount.count", 0] },
//             },
//           },
//           // Calculate unread messages
//           unreadMessages: {
//             $map: {
//               input: {
//                 $filter: {
//                   input: "$unreadMessages",
//                   as: "item",
//                   cond: { $eq: ["$$item.user", userId] },
//                 },
//               },
//               as: "unreadItem",
//               in: "$$unreadItem.message",
//             },
//           },
//         },
//       },
//     ]);

//     console.log(
//       "🔍 Aggregation result:",
//       JSON.stringify(conversations, null, 2)
//     );
//     res.status(200).json(conversations);
//   } catch (error) {
//     console.error("🔥 Error in Unreadmessage:", error);
//     res.status(500).json({
//       message: "Server Error",
//       error: error.message,
//     });
//   }
// };

// Backend Controller - MarkMessagesAsRead

exports.MarkMessagesAsRead = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const { senderId } = req.body; // Frontend માંથી sender ID આવશે

    console.log("🔍 Current User ID:", userId);
    console.log("🔍 Sender ID to mark as read:", senderId);

    if (!senderId) {
      return res.status(400).json({
        message: "Sender ID is required",
      });
    }

    const senderObjectId = new mongoose.Types.ObjectId(senderId);

    // Find conversation between current user and sender
    const conversation = await MessageModel.findOne({
      chatType: "private",
      "userIds.user": { $all: [userId, senderObjectId] },
    });

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    // Update conversation to mark messages as read
    const updateResult = await MessageModel.updateOne(
      {
        _id: conversation._id,
        chatType: "private",
        "userIds.user": { $all: [userId, senderObjectId] },
      },
      {
        // Remove current user's unread message count entry
        $pull: {
          unreadMessageCount: { user: userId },
          unreadMessages: { user: userId },
        },
      }
    );

    console.log("✅ Update Result:", updateResult);

    if (updateResult.modifiedCount > 0) {
      res.status(200).json({
        success: true,
        message: "Messages marked as read successfully",
        modifiedCount: updateResult.modifiedCount,
      });
    } else {
      res.status(200).json({
        success: true,
        message: "No unread messages to mark as read",
        modifiedCount: 0,
      });
    }
  } catch (error) {
    console.error("🔥 Error in MarkMessagesAsRead:", error);
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// Updated Unreadmessage controller
exports.Unreadmessage = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    console.log("🔍 Searching for userId:", userId);

    // Simple aggregation to get unread messages
    const conversations = await MessageModel.aggregate([
      {
        $match: {
          chatType: "private",
          "userIds.user": userId,
        },
      },
      {
        $addFields: {
          otherUserId: {
            $first: {
              $filter: {
                input: "$userIds",
                as: "uid",
                cond: { $ne: ["$$uid.user", userId] },
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "otherUserId.user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          user: {
            _id: 1,
            firstname: 1,
            lastname: 1,
            email: 1,
            profile_avatar: 1,
          },
          // Calculate unread count for current user
          unreadMessageCount: {
            $let: {
              vars: {
                userCount: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$unreadMessageCount",
                        as: "item",
                        cond: { $eq: ["$$item.user", userId] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: { $ifNull: ["$$userCount.count", 0] },
            },
          },
          // Get unread messages for current user
          unreadMessages: {
            $map: {
              input: {
                $filter: {
                  input: "$unreadMessages",
                  as: "item",
                  cond: { $eq: ["$$item.user", userId] },
                },
              },
              as: "unreadItem",
              in: "$$unreadItem.message",
            },
          },
        },
      },
      // Only return conversations with unread messages
      {
        $match: {
          unreadMessageCount: { $gt: 0 },
        },
      },
    ]);

    console.log("🔍 Unread conversations found:", conversations.length);
    res.status(200).json(conversations);
  } catch (error) {
    console.error("🔥 Error in Unreadmessage:", error);
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};
