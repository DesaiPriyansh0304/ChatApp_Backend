const User = require("../model/User-model");
const Message = require("../model/Message-model");
const conrdinary = require("../utils/Generate/Cloudinary");
const mongoose = require("mongoose");

//UpdateProfile Controller
exports.updateProfile = async (req, res) => {
  try {
    const { profile_avatar, bio, firstname, lastname, mobile, dob, gender } =
      req.body;
    const userId = req.user.userId;
    // console.log("userId/upadte/auth controler --->", userId);
    // console.log(" Full req.user:", req.user);

    const existingUser = await User.findById(userId);
    console.log("Existing user before update:", existingUser);
    let updateUser;
    // console.log("✌️updateUser --->", updateUser);

    if (!profile_avatar) {
      await User.findByIdAndUpdate(
        userId,
        { bio, firstname, lastname, mobile, dob, gender },
        { new: true }
      );
    } else {
      const upload = await conrdinary.uploader.upload(profile_avatar);
      updateUser = await User.findByIdAndUpdate(
        userId,
        {
          profile_avatar: upload.secure_url,
          bio,
          firstname,
          lastname,
          mobile,
          dob,
          gender,
        },
        { new: true }
      );
      // console.log("updateUser --->auth controller", updateUser);
      res.status(201).json({ success: true, user: updateUser });
    }
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Internal server error  updateProfile" });
  }
};

//favoriteItem
exports.favorite = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("✌️userId --->", userId);

    const { messageId, chatType, content, type } = req.body;
    console.log("✌️req.body --->", req.body);
    console.log("✅ userId:", userId);
    console.log("✅ req.body:", req.body);
    console.log("✅ messageId:", messageId);
    console.log("✅ chatType:", chatType);
    console.log("✅ type:", type);
    console.log("✅ content:", content);

    // if (!messageId || !chatType || !type) {
    //   return res.status(400).json({ msg: "All fields are required" });
    // }
    if (!messageId)
      return res.status(400).json({ msg: "messageId is required" });
    if (!chatType) return res.status(400).json({ msg: "chatType is required" });
    if (!type) return res.status(400).json({ msg: "type is required" });

    // Avoid duplicate entries
    const user = await User.findById(userId);
    const alreadyFavorited = user.isFavorite.some(
      (fav) => fav.messageId.toString() === messageId
    );

    if (alreadyFavorited) {
      return res.status(400).json({ msg: "Message already in favorites" });
    }

    await User.findByIdAndUpdate(userId, {
      $push: {
        isFavorite: {
          messageId,
          chatType,
          content,
          type,
        },
      },
    });

    res.status(200).json({ msg: "Message added to favorites" });
  } catch (error) {
    console.error("Favorite Error:", error);
    res.status(500).json({ msg: "Server Error" });
  }
  ``;
};

//SerchUser/
exports.SearchUser = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    // Case-insensitive partial match in firstname, lastname, or email
    const users = await User.find({
      $or: [
        { firstname: { $regex: query, $options: "i" } },
        { lastname: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    }).select("firstname lastname email profile_avatar"); // select only needed fields

    res.status(200).json(users);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

//getFilter User Controller
exports.getfilterByUser = async (req, res) => {
  try {
    const { filter, searchQuery } = req.body; // include searchQuery
    console.log("req.body --->/", req.body);
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get invited users and populate details
    const invitedUsersWithDetails = await Promise.all(
      (user.invitedUsers || []).map(async (invitedUser) => {
        try {
          let populatedUser = null;

          if (
            invitedUser.user &&
            mongoose.Types.ObjectId.isValid(invitedUser.user)
          ) {
            populatedUser = await User.findById(invitedUser.user).select(
              "firstname lastname email profile_avatar bio is_Confirmed gender mobile dob isadmin"
            );
          }

          return {
            _id: invitedUser._id,
            email: invitedUser.email,
            invited_is_Confirmed: invitedUser.invited_is_Confirmed,
            invitationMessage: invitedUser.invitationMessage || null,
            user: populatedUser,
          };
        } catch (err) {
          console.error("Error fetching invited user:", err);
          return {
            _id: invitedUser._id,
            email: invitedUser.email,
            invited_is_Confirmed: invitedUser.invited_is_Confirmed,
            invitationMessage: invitedUser.invitationMessage || null,
            user: null,
          };
        }
      })
    );

    // Filter invited users
    let filtered = [];
    if (filter === "verify") {
      filtered = invitedUsersWithDetails.filter(
        (u) => u.invited_is_Confirmed === true && u.user === null
      );
    } else if (filter === "unverify") {
      filtered = invitedUsersWithDetails.filter(
        (u) => u.invited_is_Confirmed === false && u.user === null
      );
    } else if (filter === "pending") {
      filtered = invitedUsersWithDetails.filter(
        (u) => u.invited_is_Confirmed === false && u.user !== null
      );
    } else {
      filtered = invitedUsersWithDetails;
    }

    // Apply search on filtered users
    let finalResult = filtered;

    if (searchQuery && searchQuery.trim() !== "") {
      const searchTerms = searchQuery.toLowerCase().split(" ").filter(Boolean);

      finalResult = filtered.filter((u) => {
        const userObj = u.user;

        let valuesToSearch = [];

        if (filter === "verify" || filter === "unverify") {
          valuesToSearch = [u.email?.toLowerCase() || ""];
        } else if (filter === "pending") {
          valuesToSearch = [
            u.email?.toLowerCase() || "",
            userObj?.firstname?.toLowerCase() || "",
            userObj?.lastname?.toLowerCase() || "",
          ];
        } else {
          // fallback for "all"
          valuesToSearch = [
            u.email?.toLowerCase() || "",
            userObj?.firstname?.toLowerCase() || "",
            userObj?.lastname?.toLowerCase() || "",
            userObj?.gender?.toLowerCase() || "",
          ];
        }

        return searchTerms.every((term) =>
          valuesToSearch.some((field) => field.includes(term))
        );
      });
    }

    return res.status(200).json({
      message: "Filtered invited users fetched successfully.",
      filter: filter || "all",
      searchQuery: searchQuery || null,
      users: finalResult,
    });
  } catch (error) {
    console.error("getFilteredInvitedUsers Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//online user by Controller
exports.onlineByUser = async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds)) {
      return res.status(400).json({ error: "userIds must be an array" });
    }

    const users = await User.find({ _id: { $in: userIds } }).select(
      "_id firstName lastName avatar"
    );

    res.status(200).json({ users });
  } catch (err) {
    console.error("Error fetching user details:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAllChatsForUser = async (req, res) => {
  try {
    const userId = req.user.id; // Login user ID from JWT token or session

    // Find all conversations where user is participant
    const conversations = await Message.find({
      $or: [
        // Private chats where user is in userIds array
        {
          chatType: "private",
          userIds: { $in: [userId] },
        },
        // Group chats where user is in userIds array
        {
          chatType: "group",
          userIds: { $in: [userId] },
        },
      ],
    })
      .populate("userIds", "firstname lastname profile_avatar bio") // Populate user details
      .populate("groupId", "groupName groupAvatar") // Populate group details if exists
      .sort({ updatedAt: -1 }); // Sort by last updated time (latest first)

    // Format the response data
    const chatList = conversations.map((conversation) => {
      // Get last message
      const lastMessage =
        conversation.messages.length > 0
          ? conversation.messages[conversation.messages.length - 1]
          : null;

      // For private chat, get the other user's details
      let chatDetails = {};

      if (conversation.chatType === "private") {
        const otherUser = conversation.userIds.find(
          (user) => user._id.toString() !== userId.toString()
        );

        chatDetails = {
          chatId: conversation._id,
          chatType: "private",
          userId: otherUser?._id,
          name: otherUser
            ? `${otherUser.firstname} ${otherUser.lastname}`
            : "Unknown User",
          avatar: otherUser?.profile_avatar || null,
          bio: otherUser?.bio || null,
          isOnline: false, // You can implement online status logic here
        };
      } else if (conversation.chatType === "group") {
        chatDetails = {
          chatId: conversation._id,
          chatType: "group",
          groupId: conversation.groupId?._id,
          name:
            conversation.groupName ||
            conversation.groupId?.groupName ||
            "Unnamed Group",
          avatar: conversation.groupId?.groupAvatar || null,
          memberCount: conversation.userIds.length,
          createdBy: conversation.createdBy,
        };
      }

      // Get unread message count for current user
      const unreadCount =
        conversation.unreadMessageCount.find(
          (item) => item.user.toString() === userId.toString()
        )?.count || 0;

      return {
        ...chatDetails,
        lastMessage: lastMessage
          ? {
              messageId: lastMessage.messageId,
              senderId: lastMessage.senderId,
              type: lastMessage.type,
              content: lastMessage.content,
              text: lastMessage.text,
              fileName: lastMessage.fileName,
              createdAt: lastMessage.createdAt,
            }
          : null,
        lastMessageTime: lastMessage?.createdAt || conversation.createdAt,
        unreadCount: unreadCount,
        updatedAt: conversation.updatedAt,
      };
    });

    // Sort by last message time (latest first)
    chatList.sort((a, b) => {
      const timeA = new Date(a.lastMessageTime);
      const timeB = new Date(b.lastMessageTime);
      return timeB - timeA; // Latest first
    });

    res.status(200).json({
      success: true,
      message: "Chats fetched successfully",
      totalChats: chatList.length,
      data: chatList,
    });
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chats",
      error: error.message,
    });
  }
};
