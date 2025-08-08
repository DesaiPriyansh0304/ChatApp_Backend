const Joi = require("joi");

// const passwordPattern = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{6,}$");
const mobilePattern = /^\d{10}$/;

const userValidationSchema = Joi.object({
  firstname: Joi.string().min(2).max(30).required().messages({
    "string.empty": "Firstname is required",
    "string.min": "Firstname must be at least 4 characters",
  }),

  lastname: Joi.string().min(2).max(30).required().messages({
    "string.empty": "Lastname is required",
    "string.min": "Lastname must be at least 4 characters",
  }),

  email: Joi.string().email().required().messages({
    "string.email": "Invalid email address",
    "any.required": "Email is required",
  }),

  mobile: Joi.string().pattern(mobilePattern).required().messages({
    "string.pattern.base": "Mobile must be a valid 10-digit number",
    "string.empty": "Mobile number is required",
  }),

  dob: Joi.date().less("now").required().messages({
    "date.less": "Date of birth must be in the past",
    "any.required": "Date of birth is required",
  }),

  gender: Joi.string().valid("male", "female", "other").required().messages({
    "any.only": "Gender must be male, female, or other",
    "any.required": "Gender is required",
  }),

  password: Joi.string().min(6).required().messages({
    "string.min": "Password must be at least 6 characters",
    "any.required": "Password is required",
  }),

  profile_avatar: Joi.string().uri().optional().messages({
    "string.uri": "Avatar must be a valid URL",
  }),

  bio: Joi.string().max(250).optional(),

  otp: Joi.string().optional(),

  otpExpiresAt: Joi.date().optional(),

  is_Confirmed: Joi.boolean().optional(),

  invitedUsers: Joi.array()
    .items(
      Joi.object({
        user: Joi.string().hex().length(24),
        email: Joi.string().email(),
        invitationMessage: Joi.string().optional(),
        invited_is_Confirmed: Joi.boolean().optional(),
      })
    )
    .optional(),

  invitedBy: Joi.array()
    .items(
      Joi.object({
        _id: Joi.string().hex().length(24),
        email: Joi.string().email(),
      })
    )
    .optional(),

  isFavorite: Joi.array()
    .items(
      Joi.object({
        messageId: Joi.string().hex().length(24),
        chatType: Joi.string().valid("private", "group").required(),
        content: Joi.array().items(Joi.string()).required(),
        type: Joi.string().valid("text", "image", "file").required(),
        addedAt: Joi.date().optional(),
      })
    )
    .optional(),
});

module.exports = {
  userValidationSchema,
};
