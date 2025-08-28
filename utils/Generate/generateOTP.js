const generateOtp = () => {
  const otp = crypto.randomInt(100000, 999999).toString(); // 6-digit OTP
  const otpExpiresAt = new Date(Date.now() + 3 * 60 * 1000); // expiry 3 minutes from now

  return { otp, otpExpiresAt };
};

module.exports = generateOtp;
