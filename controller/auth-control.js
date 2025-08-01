const User = require("../model/User-model");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const generateToken = require("../utils/generateToken");
const conrdinary = require("../utils/Cloudinary");
const generateOtp = require("../utils/generateOTP");
const sendEmailUtil = require("../utils/Nodemailerutil");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { oauth2cilent } = require("../utils/oAuth/Googleconfig");
const { default: axios } = require("axios");
const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_TOKEN_URL,
  GITHUB_USER_URL,
} = require("../utils/oAuth/Githubconfig");

{
  /*Register Section*/
}
exports.Register = async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      email,
      mobile,
      dob,
      gender,
      password,
      profile_avatar,
    } = req.body;

    // Check if user already exists
    const userExist = await User.findOne({ email });
    if (userExist) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Email already exists.",
      });
    }

    // Generate OTP
    const otp = generateOtp();
    const otpExpiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes from now

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const userCreated = await User.create({
      firstname,
      lastname,
      email,
      mobile,
      dob,
      gender,
      password: hashedPassword,
      profile_avatar,
      otp,
      otpExpiresAt,
      is_Confirmed: false,
    });

    //invited by
    const inviter = await User.findOne({ "invitedUsers.email": email });
    if (inviter) {
      // Add invitedBy info to the new user
      userCreated.invitedBy = [
        {
          _id: inviter._id,
          email: inviter.email,
        },
      ];
      const invitedUser = inviter.invitedUsers.find((u) => u.email === email);
      if (invitedUser) {
        invitedUser.user = userCreated._id;
        invitedUser.invited_is_Confirmed = false;
      }
      await inviter.save();
    }

    await userCreated.save();

    // Send OTP email using utility
    await sendEmailUtil({
      to: email,
      subject: "Verify Your Email - OTP",
      text: `Hi ${firstname},\n\nYour OTP code is: ${otp}\n\nThis OTP is valid for 3 minutes.`,
    });

    // Send response
    res.status(201).json({
      status: 201,
      success: true,
      msg: "SignUp Successful. OTP sent to your email.Please verify",
      // data: userCreated,
      userId: userCreated._id.toString(),
    });
  } catch (error) {
    console.error("Register Error:", error);
    res
      .status(500)
      .json({ message: "Internal server error during registration." });
  }
};

{
  /*Login Section*/
}
exports.Login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const userExist = await User.findOne({ email });
    if (!userExist) {
      return res.status(400).json({
        status: 400,
        message: "Email/User Not Valid.",
      });
    }

    // Check if email is verified
    if (!userExist.is_Confirmed) {
      return res.status(403).json({
        status: 403,
        message:
          "Email not verified. Please verify your email before logging in.",
      });
    }

    // Compare hashed password
    const isMatch = await bcrypt.compare(password, userExist.password);
    if (!isMatch) {
      return res.status(400).json({
        status: 400,
        message: "Invalid Password.",
      });
    }

    // Successful login response
    res.status(200).json({
      status: 200,
      success: true,
      message: "Login successful",
      userData: userExist,
      token: generateToken(userExist),
      userId: userExist._id.toString(),
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Internal server error during login.",
    });
  }
};
{
  /*update to user profile deatil*/
}
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

//googlelogin

exports.googlelogin = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Authorization code is required",
      });
    }

    console.log("Google OAuth Code received:", code);

    // Get tokens from Google
    const googleRes = await oauth2cilent.getToken(code);
    oauth2cilent.setCredentials(googleRes.tokens);

    console.log("Google tokens received:", googleRes.tokens);

    // Get user info from Google
    const userRes = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${googleRes.tokens.access_token}`
    );

    console.log("Google user data:", userRes.data);

    const { email, name, picture, given_name, family_name } = userRes.data;

    if (!email) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Email not provided by Google",
      });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user if doesn't exist
      user = await User.create({
        firstname: given_name || name?.split(" ")[0] || "Google",
        lastname: family_name || name?.split(" ")[1] || "User",
        email: email,
        mobile: "", // You can ask for this later or make it optional
        dob: new Date(), // Default date, you can ask for this later
        gender: "other", // Default gender, you can ask for this later
        password: "google_oauth", // Placeholder password for Google users
        profile_avatar: picture || "",
        is_Confirmed: true, // Google users are automatically confirmed
      });

      console.log("New user created:", user);
    } else {
      // Update existing user's profile picture if available
      if (picture && !user.profile_avatar) {
        user.profile_avatar = picture;
        await user.save();
      }

      console.log("Existing user found:", user);
    }

    // Generate token
    const token = generateToken(user);

    // Successful Google login response
    res.status(200).json({
      status: 200,
      success: true,
      message: "Google Login successful",
      userData: {
        _id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        profile_avatar: user.profile_avatar,
      },
      token: token,
      userId: user._id.toString(),
    });
  } catch (error) {
    console.error("Google Login Error:", error);

    // Better error handling
    if (error.code === "invalid_grant") {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Invalid authorization code. Please try again.",
      });
    }

    if (error.response) {
      console.error("Google API Error:", error.response.data);
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Google authentication failed. Please try again.",
      });
    }

    res.status(500).json({
      status: 500,
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

exports.githublogin = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Authorization code is required",
      });
    }

    console.log("GitHub OAuth Code received:", code);

    // Step 1: Exchange code for access token
    const tokenResponse = await axios.post(
      GITHUB_TOKEN_URL,
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code: code,
      },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    console.log("GitHub token response:", tokenResponse.data);

    const { access_token, error } = tokenResponse.data;

    if (error || !access_token) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Failed to get access token from GitHub",
      });
    }

    // Step 2: Get user info from GitHub
    const userResponse = await axios.get(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    console.log("GitHub user data:", userResponse.data);

    const {
      id: githubId,
      login: username,
      email,
      name,
      avatar_url,
    } = userResponse.data;

    // Step 3: Get user email if not public
    let userEmail = email;
    if (!userEmail) {
      try {
        const emailResponse = await axios.get(`${GITHUB_USER_URL}/emails`, {
          headers: {
            Authorization: `Bearer ${access_token}`,
            Accept: "application/vnd.github.v3+json",
          },
        });

        // Find primary email
        const primaryEmail = emailResponse.data.find((email) => email.primary);
        userEmail = primaryEmail ? primaryEmail.email : null;
      } catch (emailError) {
        console.log("Could not fetch email:", emailError.message);
      }
    }

    if (!userEmail) {
      return res.status(400).json({
        status: 400,
        success: false,
        message:
          "Email not provided by GitHub. Please make your email public in GitHub settings.",
      });
    }

    // Step 4: Check if user exists
    let user = await User.findOne({ email: userEmail });

    if (!user) {
      // Create new user if doesn't exist
      const nameParts = (name || username || "GitHub User").split(" ");
      const firstname = nameParts[0] || "GitHub";
      const lastname = nameParts.slice(1).join(" ") || "User";

      user = await User.create({
        firstname: firstname,
        lastname: lastname,
        email: userEmail,
        mobile: "", // You can ask for this later or make it optional
        dob: new Date(), // Default date, you can ask for this later
        gender: "other", // Default gender, you can ask for this later
        password: "github_oauth", // Placeholder password for GitHub users
        profile_avatar: avatar_url || "",
        is_Confirmed: true, // GitHub users are automatically confirmed
      });

      console.log("New user created:", user);
    } else {
      // Update existing user's profile picture if available
      if (avatar_url && !user.profile_avatar) {
        user.profile_avatar = avatar_url;
        await user.save();
      }

      console.log("Existing user found:", user);
    }

    // Step 5: Generate token and send response
    const token = generateToken(user);

    // Successful GitHub login response
    res.status(200).json({
      status: 200,
      success: true,
      message: "GitHub Login successful",
      userData: {
        _id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        profile_avatar: user.profile_avatar,
      },
      token: token,
      userId: user._id.toString(),
    });
  } catch (error) {
    console.error("GitHub Login Error:", error);

    // Better error handling
    if (error.response) {
      console.error("GitHub API Error:", error.response.data);
      return res.status(400).json({
        status: 400,
        success: false,
        message: "GitHub authentication failed. Please try again.",
      });
    }

    res.status(500).json({
      status: 500,
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};
