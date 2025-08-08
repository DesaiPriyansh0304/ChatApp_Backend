const User = require("../../../model/User-model");
const bcrypt = require("bcryptjs");
const generateToken = require("../../../utils/Generate/generateToken");
const generateOtp = require("../../../utils/Generate/generateOTP");
const sendEmailUtil = require("../../../utils/Generate/Nodemailerutil");
const { oauth2cilent } = require("../../../utils/oAuth/Googleconfig");
const { default: axios } = require("axios");
const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_TOKEN_URL,
  GITHUB_USER_URL,
} = require("../../../utils/oAuth/Githubconfig");
const {
  userValidationSchema,
} = require("../../../validation/model-validation/User-Validation");

//Register Controller
exports.Register = async (req, res) => {
  try {
    //validation input filed
    const validatedData = await userValidationSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    const {
      firstname,
      lastname,
      email,
      mobile,
      dob,
      gender,
      password,
      profile_avatar,
    } = validatedData;

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
      msg: "SignUp Successful. OTP sent to your email.Please verify",
      // data: userCreated,
      userId: userCreated._id.toString(),
    });
  } catch (error) {
    console.log("Register Error:", error);
    res
      .status(500)
      .json({ message: "Internal server error during registration." });
  }
};

//Login Controller
exports.Login = async (req, res) => {
  try {
    const { email, password, recaptcha } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        status: 400,
        message: "Email and password are required.",
      });
    }

    // Validate reCAPTCHA
    if (!recaptcha) {
      return res.status(400).json({
        status: 400,
        message: "Please complete the reCAPTCHA verification.",
      });
    }

    // Verify reCAPTCHA with Google
    try {
      const recaptchaSecret =
        process.env.RECAPTCHA_SECRET_KEY ||
        "6LcBV50rAAAAAOueCc8LqUmd6HHT8IeGRP4jcsQ-";

      const recaptchaResponse = await axios.post(
        "https://www.google.com/recaptcha/api/siteverify",
        null,
        {
          params: {
            secret: recaptchaSecret,
            response: recaptcha,
            remoteip: req.ip || req.connection.remoteAddress,
          },
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const recaptchaData = recaptchaResponse.data;
      console.log("reCAPTCHA verification result:", recaptchaData);

      if (!recaptchaData.success) {
        return res.status(400).json({
          status: 400,
          message: "reCAPTCHA verification failed. Please try again.",
          recaptchaError: recaptchaData["error-codes"] || [],
        });
      }

      // Optional: Check score for reCAPTCHA v3 (if you upgrade later)
      if (recaptchaData.score && recaptchaData.score < 0.5) {
        return res.status(400).json({
          status: 400,
          message: "reCAPTCHA verification failed. Please try again.",
        });
      }
    } catch (recaptchaError) {
      console.error("reCAPTCHA verification error:", recaptchaError);
      return res.status(500).json({
        status: 500,
        message: "reCAPTCHA verification failed. Please try again later.",
      });
    }

    // Check if user exists
    const userExist = await User.findOne({ email });
    if (!userExist) {
      return res.status(400).json({
        status: 400,
        message: "User not found with this email.",
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
        message: "Invalid password.",
      });
    }

    // Successful login response
    res.status(200).json({
      status: 200,
      message: "Login successful",
      token: generateToken(userExist),
      userData: {
        id: userExist._id,
        email: userExist.email,
        firstname: userExist.firstname,
        lastname: userExist.lastname,
        // Add other non-sensitive user data as needed
      },
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

//google Login Controller
exports.googlelogin = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        status: 400,
        message: "Authorization code is required",
      });
    }

    // console.log("Google OAuth Code received/Google Login:", code);

    // Get tokens from Google
    const googleRes = await oauth2cilent.getToken(code);
    oauth2cilent.setCredentials(googleRes.tokens);

    // console.log("Google tokens received/Google Login:", googleRes.tokens);

    // Get user info from Google
    const userRes = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${googleRes.tokens.access_token}`
    );

    // console.log("Google user data/Google Login:", userRes.data);

    const { email, name, picture, given_name, family_name } = userRes.data;

    if (!email) {
      return res.status(400).json({
        status: 400,
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
        mobile: "",
        dob: new Date(),
        gender: "other",
        password: "google_oauth",
        profile_avatar: picture || "",
        is_Confirmed: true,
      });

      //   console.log("New user created/Google Login:", user);
    } else {
      // Update existing user's profile picture if available
      if (picture && !user.profile_avatar) {
        user.profile_avatar = picture;
        await user.save();
      }

      //   console.log("Existing user found/Google Login:", user);
    }

    // Generate token
    const token = generateToken(user);

    // Successful Google login response
    res.status(200).json({
      status: 200,
      //   userData: {
      //     _id: user._id,
      //     firstname: user.firstname,
      //     lastname: user.lastname,
      //     email: user.email,
      //     profile_avatar: user.profile_avatar,
      //   },
      token: token,
      //   userId: user._id.toString(),
    });
  } catch (error) {
    console.log("Google Login Error/Google Login:", error);

    // Better error handling
    if (error.code === "invalid_grant") {
      return res.status(400).json({
        status: 400,
        message: "Invalid authorization code. Please try again.",
      });
    }

    if (error.response) {
      console.log("Google API Error:", error.response.data);
      return res.status(400).json({
        status: 400,
        message: "Google authentication failed. Please try again.",
      });
    }

    res.status(500).json({
      status: 500,
      message: "Internal server error. Please try again later.",
    });
  }
};

//github Login Controller
exports.githublogin = async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;

    if (!code) {
      return res.status(400).json({
        status: 400,
        message: "Authorization code is required",
      });
    }

    // console.log("GitHub OAuth Code received/Github Login:", code);
    // console.log("Redirect URI received/Github Login:", redirect_uri);

    // Step 1: Exchange code for access token
    const tokenRequestData = {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code: code,
    };

    // Add redirect_uri if provided by frontend
    if (redirect_uri) {
      tokenRequestData.redirect_uri = redirect_uri;
    }

    const tokenResponse = await axios.post(GITHUB_TOKEN_URL, tokenRequestData, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    // console.log("GitHub token response/Github Login:", tokenResponse.data);

    const { access_token, error, error_description } = tokenResponse.data;

    if (error || !access_token) {
      console.log("GitHub OAuth Error:", error, error_description);
      return res.status(400).json({
        status: 400,
        message: error_description || "Failed to get access token from GitHub",
        error: error,
      });
    }

    // Step 2: Get user info from GitHub
    const userResponse = await axios.get(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "ChatApp-OAuth", // GitHub requires User-Agent header
      },
    });

    // console.log("GitHub user data/Github Login:", userResponse.data);

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
            "User-Agent": "ChatApp-OAuth",
          },
        });

        // Find primary email
        const primaryEmail = emailResponse.data.find((email) => email.primary);
        userEmail = primaryEmail ? primaryEmail.email : null;

        // console.log("GitHub emails/Github Login:", emailResponse.data);
      } catch (emailError) {
        console.log("Could not fetch email/Github Login:", emailError.message);
      }
    }

    if (!userEmail) {
      return res.status(400).json({
        status: 400,
        message:
          "Email not provided by GitHub. Please make your email public in GitHub settings or grant email permission.",
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
        mobile: "",
        dob: new Date(),
        gender: "other",
        password: "github_oauth",
        profile_avatar: avatar_url || "",
        is_Confirmed: true,
        github_id: githubId,
      });

      //   console.log("New user created/Github Login:", user);
    } else {
      // Update existing user's profile picture and GitHub ID if available
      let updated = false;

      if (avatar_url && !user.profile_avatar) {
        user.profile_avatar = avatar_url;
        updated = true;
      }

      if (githubId && !user.github_id) {
        user.github_id = githubId;
        updated = true;
      }

      if (updated) {
        await user.save();
      }

      //   console.log("Existing user found/Github Login:", user);
    }

    // Step 5: Generate token and send response
    const token = generateToken(user);

    // Successful GitHub login response
    res.status(200).json({
      status: 200,
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
    console.log("GitHub Login Error/Github Login:", error);

    // Better error handling
    if (error.response) {
      //   console.log("GitHub API Error/Github Login:", error.response.data);
      //   console.log("GitHub API Status/Github Login:", error.response.status);

      // Handle specific GitHub API errors
      if (error.response.status === 401) {
        return res.status(400).json({
          status: 400,
          message:
            "Invalid GitHub credentials. Please check your GitHub OAuth app configuration.",
        });
      }

      if (error.response.status === 403) {
        return res.status(400).json({
          status: 400,
          message: "GitHub API rate limit exceeded. Please try again later.",
        });
      }

      return res.status(400).json({
        status: 400,
        message: "GitHub authentication failed. Please try again.",
        error: error.response.data,
      });
    }

    res.status(500).json({
      status: 500,
      message: "Internal server error. Please try again later.",
    });
  }
};
