const User = require("../../model/User-model");
const sendEmailUtil = require("../../utils/Generate/Nodemailerutil");
const jwt = require("jsonwebtoken");

//verify-inviteduser
exports.invitedUsersverify = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Token not provided" });
    }

    const JWT_SECRET = process.env.JWT_SECRET_KEY;
    if (!JWT_SECRET) {
      return res
        .status(500)
        .json({ success: false, message: "JWT secret not configured" });
    }

    // 🔐 Token verification
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.error("Token verification failed:", err.message);
      const msg =
        err.name === "TokenExpiredError"
          ? "Token has expired"
          : "Token invalid or expired";
      return res.status(401).json({ success: false, message: msg });
    }

    const invitedUserEmail = decoded.email; // Token માં email store કરીશું
    const inviterId = decoded.inviterId; // Token માં inviter ID પણ store કરીશું

    // 🔍 Find inviter
    const inviter = await User.findById(inviterId);
    if (!inviter) {
      return res
        .status(404)
        .json({ success: false, message: "Inviter not found" });
    }

    // ✅ Check if this email was actually invited by this inviter
    const invitedEntry = inviter.invitedUsers.find(
      (entry) => entry.email.toLowerCase() === invitedUserEmail.toLowerCase()
    );

    if (!invitedEntry) {
      return res.status(400).json({
        success: false,
        message: "This email was not invited by the specified inviter",
      });
    }

    // ✅ Update inviter's invitedUsers[].invited_is_Confirmed = true
    await User.updateOne(
      { _id: inviter._id, "invitedUsers.email": invitedUserEmail },
      { $set: { "invitedUsers.$.invited_is_Confirmed": true } }
    );

    return res.status(200).json({
      success: true,
      message: "Invitation verified successfully! You can now register.",
      data: {
        email: invitedUserEmail,
        inviterName: `${inviter.firstname} ${inviter.lastname}`,
        inviterEmail: inviter.email,
      },
    });
  } catch (error) {
    console.error("Error in verifyInvitedUser:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

//invitedUsers - હવે user create નહીં કરશે
exports.invitedUsers = async (req, res) => {
  try {
    const inviterId = req.user._id;
    const rawEmail = req.body.email;
    const message = req.body.message || "";

    if (!rawEmail) {
      return res.status(400).json({ message: "Email is required." });
    }

    const email = rawEmail.trim().toLowerCase();

    // ✅ Check if user already exists with this email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message:
          "User with this email already exists. They can directly login.",
      });
    }

    const inviter = await User.findById(inviterId);
    if (!inviter) {
      return res.status(404).json({ message: "Inviter not found." });
    }

    // ✅ Check if already invited
    const alreadyInvited = inviter.invitedUsers.some(
      (entry) => entry.email.toLowerCase() === email
    );

    if (alreadyInvited) {
      return res.status(400).json({
        message: "This email has already been invited.",
      });
    }

    // ✅ Create JWT token with email and inviter info
    const token = jwt.sign(
      {
        email: email,
        inviterId: inviterId,
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "7d" }
    );

    const link = `http://localhost:5173/contact/${token}`;

    // ✅ Send invitation email
    await sendEmailUtil({
      to: email,
      subject: "You're Invited to join our Chat App!",
      text: `Hi,\n\nYou've been invited by ${inviter.firstname} ${inviter.lastname} to join our chat app.\n\nMessage: ${message}\n\nClick here to join: ${link}\n\nThis invitation will expire in 7 days.`,
    });

    // ✅ Add only email to inviter's invitedUsers[] (NO user creation)
    inviter.invitedUsers.push({
      email: email,
      invitationMessage: message,
      invited_is_Confirmed: false,
    });
    await inviter.save();

    const updatedInviter = await User.findById(inviterId);

    res.status(200).json({
      message: "Invitation sent successfully.",
      invitedUsers: updatedInviter.invitedUsers,
    });
  } catch (error) {
    console.error("InvitedUsers Error:", error);
    res
      .status(500)
      .json({ message: "Internal server error during invitedUsers." });
  }
};
