const MessageModel = require("../../model/Message-model");

exports.CreateGroup = async (req, res) => {
  try {
    const { groupName, description, members } = req.body;
    // console.log("req.body/Create Gorup --->Group controller", req.body);
    const creatorId = req.user._id;
    // console.log("creatorId/Create Gorup --->Group controller", creatorId);

    const newGroup = new MessageModel({
      chatType: "group",
      groupName,
      description,
      userIds: [
        {
          user: creatorId,
          addedAt: new Date(),
          role: "admin", // creator is admin
        },
        ...members.map((id) => ({
          user: id,
          addedAt: new Date(),
          role: "member", // others are default members
        })),
      ],
      createdBy: creatorId,
      messages: [],
    });

    newGroup.groupId = newGroup._id;
    await newGroup.save();

    // const populatedGroup = await newGroup.populate(
    //   "createdBy",
    //   "firstname lastname email"
    // );

    return res.status(201).json({
      status: 200,
      message: "Group Created Successfully",
      //   group: populatedGroup,
    });
  } catch (error) {
    console.log("Group creation error:", error);
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

//Delete Group
exports.DeleteGroup = async (req, res) => {
  try {
    const { groupId } = req.body;
    const userId = req.user._id;

    const group = await MessageModel.findById(groupId);
    if (!group)
      return res.status(404).json({
        status: 404,
        message: "Group not found",
      });

    const isAdmin = group.userIds.find(
      (u) => u.user.toString() === userId.toString() && u.role === "admin"
    );

    if (!isAdmin) {
      return res.status(403).json({
        status: 403,
        message: "Only admin can delete group",
      });
    }

    await MessageModel.findByIdAndDelete(groupId);
    res.status(200).json({
      status: 200,
      message: "Group deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

//leave Group
exports.LeaveGroup = async (req, res) => {
  try {
    const { groupId } = req.body;
    const userId = req.user._id;

    const group = await MessageModel.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const currentUser = group.userIds.find(
      (u) => u.user.toString() === userId.toString()
    );

    if (!currentUser) {
      return res.status(403).json({ message: "User not in group" });
    }

    // Block admin from leaving directly
    if (currentUser.role === "admin") {
      return res
        .status(403)
        .json({ message: "Admin cannot leave group directly" });
    }

    // Remove user from group
    await MessageModel.findByIdAndUpdate(groupId, {
      $pull: { userIds: { user: userId } },
    });

    res.status(200).json({ message: "Left group successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//grop find in user
exports.getUserGroups = async (req, res) => {
  try {
    const groups = await MessageModel.find({ chatType: "group" })
      .select("-messages")
      .populate({
        path: "createdBy",
        select: "_id firstname lastname email ",
      })
      .populate({
        path: "userIds.user",
        model: "User",
        select: "_id firstname lastname email profile_avatar bio dob mobile",
      });

    res.status(200).json({
      status: 200,
      groups,
    });
  } catch (error) {
    console.log(" Error - GetUserGroup:", error);
    res.status(500).json({
      status: 500,
      message: "Internal Server Error",
    });
  }
};

//ADD Member
exports.GroupAddmember = async (req, res) => {
  try {
    const { groupId, newMemberIds } = req.body;
    // console.log("req.body/GropAddMember --->Group-Controller", req.body);
    const requesterId = req.user._id;

    const group = await MessageModel.findById(groupId);
    if (!group)
      return res.status(404).json({
        status: 404,
        message: "Group not found",
      });

    const requester = group.userIds.find(
      (u) => u.user.toString() === requesterId.toString()
    );

    if (!requester || !["admin", "subadmin"].includes(requester.role)) {
      return res.status(403).json({
        status: 403,
        message: "Permission denied",
      });
    }

    const newMembers = newMemberIds.map((id) => ({
      user: id,
      addedAt: new Date(),
      role: "member",
    }));

    group.userIds.push(...newMembers);
    await group.save();

    res.status(200).json({
      status: 200,
      //   message: "Members added",
      group,
    });
  } catch (err) {
    console.log("Add member error:", err);
    res.status(500).json({
      status: 500,
      message: err.message,
    });
  }
};
