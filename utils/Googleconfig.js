const { google } = require("googleapis");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET; // Fixed: was GOOGLE_CLIENT_GOOGLE_CLIENT_SECRET

// Create OAuth2 client
exports.oauth2cilent = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  "postmessage" // This is correct for auth-code flow
);
