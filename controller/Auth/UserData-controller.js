const UserModel = require("../../model/User-model");
const mongoose = require("mongoose");

// controller to checked if user is authnticated(Login User)
exports.checkAuth = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        status: 401,
        message: "Unauthorized User",
      });
    }

    const userId = req.user.userId;
    // console.log("userId --->userdata/chakeAuth", userId);

    const userData = await UserModel.findById(userId).select(
      "-password -otp -otpExpiresAt "
    );
    // console.log("userData-->userdata/checkauth", userData);

    if (!userData) {
      return res.status(404).json({
        status: 404,
        message: "User not found",
      });
    }

    res.status(200).json({
      status: 200,
      userData,
    });
  } catch (error) {
    console.log("Error in checkAuth:/Userdata-Controller", error.message);
    res.status(500).json({
      message: "Server Error",
    });
  }
};

//get all user data
exports.GetAlluserData = async (req, res) => {
  try {
    const users = await UserModel.find({}, "-password");
    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Internal server error GetAllUserdata" });
  }
};

//getdbUserdata
exports.getdbUserdata = async (req, res) => {
  try {
    const loginUserId = req.user.userId?.toString();
    // console.log("loginUserId --->GetUserData", loginUserId);

    if (!loginUserId) {
      return res.status(400).json({
        status: 400,
        message: "Invalid user ID",
      });
    }

    const loginUser = await UserModel.findById(loginUserId).select(
      "invitedUsers invitedBy"
    );

    if (!loginUser) {
      return res.status(404).json({
        status: 404,
        message: "User not found",
      });
    }

    // Debug logs
    // console.log("🔍 loginUser.invitedUsers -->", loginUser.invitedUsers);
    // console.log("🔍 loginUser.invitedBy -->", loginUser.invitedBy);

    const invitedUserIds = (loginUser.invitedUsers || []).map((invite) =>
      invite?.user?.toString()
    );

    const invitedByIds = (loginUser.invitedBy || []).map((invite) =>
      invite?._id?.toString()
    );

    // console.log(" invitedUserIds -->", invitedUserIds);
    // console.log(" invitedByIds -->", invitedByIds);

    const excludeIds = [loginUserId, ...invitedUserIds, ...invitedByIds].filter(
      Boolean
    );

    // console.log("excludeIds (final) -->", excludeIds);

    // Search query
    const searchQuery = req.query.search || "";
    const searchRegex = new RegExp(searchQuery, "i");

    // Mongo query
    const filter = {
      _id: { $nin: excludeIds },
    };

    if (searchQuery.trim()) {
      filter.$or = [
        { firstname: { $regex: searchRegex } },
        { lastname: { $regex: searchRegex } },
        { email: { $regex: searchRegex } },
      ];
    }

    // console.log(" Final Mongo filter -->", filter);

    const otherUsers = await UserModel.find(filter).select(
      "-password -otp -otpExpiresAt"
    );

    return res.status(200).json({
      status: 200,
      data: otherUsers,
    });
  } catch (error) {
    console.log(" Error in getdbUserdata:/Userdata", error.message);
    return res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Invited-UserData
exports.getinvitedByUser = async (req, res) => {
  try {
    const searchQuery = (req.query.search || "").toLowerCase();

    const user = await UserModel.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        status: 404,
        message: "User not found",
      });
    }

    // 1. Fetch invitedBy users
    let invitedByUsers = await Promise.all(
      (user.invitedBy || []).map(async (inviter) => {
        if (inviter._id && mongoose.Types.ObjectId.isValid(inviter._id)) {
          return await UserModel.findById(inviter._id).select(
            "firstname lastname email profile_avatar bio gender mobile dob isadmin is_Confirmed"
          );
        }
        return null;
      })
    );

    invitedByUsers = invitedByUsers.filter((u) => u !== null);

    // 2. Filter invitedBy users by searchQuery
    if (searchQuery) {
      invitedByUsers = invitedByUsers.filter((u) => {
        const fullName = `${u.firstname} ${u.lastname}`.toLowerCase();
        return (
          fullName.includes(searchQuery) ||
          u.email.toLowerCase().includes(searchQuery)
        );
      });
    }

    //  3. Fetch invitedUsers
    let invitedUsersWithDetails = await Promise.all(
      (user.invitedUsers || []).map(async (invitedUser) => {
        let populatedUser = null;

        if (
          invitedUser.user &&
          mongoose.Types.ObjectId.isValid(invitedUser.user)
        ) {
          populatedUser = await UserModel.findById(invitedUser.user).select(
            "firstname lastname email profile_avatar bio is_Confirmed gender mobile dob isadmin"
          );
        }

        return {
          _id: invitedUser._id,
          email: invitedUser.email,
          invited_is_Confirmed: invitedUser.invited_is_Confirmed,
          invitationMessage: invitedUser.invitationMessage,
          user: populatedUser,
        };
      })
    );

    //  4. Filter invitedUsers by searchQuery
    if (searchQuery) {
      invitedUsersWithDetails = invitedUsersWithDetails.filter((entry) => {
        const u = entry.user;
        if (!u) return false;

        const fullName = `${u.firstname} ${u.lastname}`.toLowerCase();
        return (
          fullName.includes(searchQuery) ||
          u.email.toLowerCase().includes(searchQuery)
        );
      });
    }

    return res.status(200).json({
      status: 200,
      data: {
        user: {
          _id: user._id,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          profile_avatar: user.profile_avatar,
          bio: user.bio,
          is_Confirmed: user.is_Confirmed,
          gender: user.gender,
          mobile: user.mobile,
          dob: user.dob,
          isadmin: user.isadmin,
        },
        invitedBy: invitedByUsers,
        invitedUsers: invitedUsersWithDetails,
      },
    });
  } catch (error) {
    console.error(" getinvitedByUser Error:/UserData", error);
    return res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};
