const UserModel = require("../../model/User-model");
const bcrypt = require("bcryptjs");
const generateOtp = require("../../utils/Generate/generateOTP");
const sendEmailUtil = require("../../utils/Generate/Nodemailerutil");

//forgetpassword
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  // console.log("req.body --->/Password-Controller/Forget-PassWord", req.body);

  if (!email) {
    return res.status(400).json({
      status: 400,
      message: "Email is required.",
    });
  }

  try {
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: 404,
        message: "User not found.",
      });
    }

    //otp
    const { otp, otpExpiresAt } = generateOtp();

    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    //send mail
    await sendEmailUtil({
      to: user.email,
      subject: "Forget Password OTP",
      text: `Your OTP to reset password is: ${otp}. It is valid for 3 minutes.`,
    });

    return res.status(200).json({
      status: 200,
      message: "OTP sent to your email.",
    });
  } catch (error) {
    console.log("error --->/Password-Controller/Forget-PassWord", error);
    return res.status(500).json({
      status: 500,
      message: "Error resetting password.",
      error: error.message || error,
    });
  }
};

//reset-password
exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  // console.log("req.body --->/Password-Controller/Reset-password", req.body);

  if (!email || !otp || !newPassword) {
    return res.status(400).json({
      status: 400,
      message: "All fields are required.",
    });
  }

  try {
    const user = await UserModel.findOne({ email });

    if (!user || !user.otp || user.otp !== otp) {
      return res.status(400).json({
        status: 400,
        message: "Invalid OTP or user.",
      });
    }

    if (user.otpExpiresAt < Date.now()) {
      return res.status(400).json({
        status: 400,
        message: "OTP expired.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.otp = null;
    user.otpExpiresAt = null;

    await user.save();

    await sendEmailUtil({
      to: user.email,
      subject: "Password Reset Successful",
      text: `Hi ${user.firstname}, your password was successfully reset.`,
    });

    return res.status(200).json({
      status: 200,
      message: "Password reset successful.",
    });
  } catch (error) {
    console.log(
      "Error in resetPassword:/Password-Controller/Reset-password",
      error
    );
    return res.status(500).json({
      status: 500,
      message: "Error resetting password.",
      error: error.message || error,
    });
  }
};
