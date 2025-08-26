const UserModel = require("../../model/User-model");
const sendEmailUtil = require("../../utils/Generate/Nodemailerutil");
const generateToken = require("../../utils/Generate/generateToken");
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
    } catch (error) {
      console.log("Token verification failed:", error.message);
      const msg =
        err.name === "TokenExpiredError"
          ? "Token has expired"
          : "Token invalid or expired";
      return res.status(401).json({ success: false, message: msg });
    }

    const invitedUserEmail = decoded.email; // Token માં email store કરીશું
    const inviterId = decoded.inviterId; // Token માં inviter ID પણ store કરીશું

    // 🔍 Find inviter
    const inviter = await UserModel.findById(inviterId);
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
    await UserModel.updateOne(
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
    console.log("Error in verifyInvitedUser:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

//invitedUsers
exports.invitedUsers = async (req, res) => {
  try {
    const inviterId = req.user.userId;
    const rawEmail = req.body.email;
    const message = req.body.message || "";
    // console.log("inviterId --->/Invited-Controller", inviterId);
    // console.log("rawEmail --->/Invited-Controller", rawEmail);
    // console.log("message --->/Invited-Controller", message);

    if (!rawEmail) {
      return res.status(400).json({
        status: 400,
        message: "Email is required.",
      });
    }

    const email = rawEmail.trim().toLowerCase();

    // user already exists
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 400,
        message:
          "User with this email already exists. They can directly login.",
      });
    }

    const inviter = await UserModel.findById(inviterId);
    if (!inviter) {
      return res.status(404).json({
        status: 400,
        message: "Inviter not found.",
      });
    }

    //already invited
    const alreadyInvited = inviter.invitedUsers.some(
      (entry) => entry.email.toLowerCase() === email
    );

    if (alreadyInvited) {
      return res.status(400).json({
        status: 400,
        message: "This email has already been invited.",
      });
    }

    const token = generateToken(inviter); //Generate Token
    const link = `http://localhost:5173/contact/${token}`;

    //  Send invitation email
    await sendEmailUtil({
      to: email,
      subject: "You're Invited to join our Chat App!",
      text: `Hi,\n\nYou've been invited by ${inviter.firstname} ${inviter.lastname} to join our chat app.\n\nMessage: ${message}\n\nClick here to join: ${link}\n\nThis invitation will expire in 7 days.`,
    });

    //  Add only email to inviter's invitedUsers[] (NO user creation)
    inviter.invitedUsers.push({
      email: email,
      invitationMessage: message,
      invited_is_Confirmed: false,
    });
    await inviter.save();

    const updatedInviter = await UserModel.findById(inviterId);

    res.status(200).json({
      status: 200,
      invitedUsers: updatedInviter.invitedUsers,
    });
  } catch (error) {
    console.log("InvitedUsers Error:", error);
    res.status(500).json({
      status: 500,
      message: "Internal server error during invitedUsers.",
    });
  }
};
