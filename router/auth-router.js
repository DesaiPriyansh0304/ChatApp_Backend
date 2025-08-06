const express = require("express");
const router = express.Router();
const AuthController = require("../controller/auth-control");
const LoginContrroller = require("../controller/Auth/Login/SignIn-SignUp");
const UserMiddleware = require("../middelware/User-middelware");
const passwordrouter = require("../router/Auth/Password-router");
const userdatarouter = require("../router/Auth/UserData-router");
const invitecontactrouter = require("../router/Auth/InvitedContact-router");
router.use("/invite", invitecontactrouter);
router.use("/password", passwordrouter);
router.use("/userdata", userdatarouter);

// Register and Login Router(Google and Github)
router.post("/signup", LoginContrroller.Register);
router.post("/signin", LoginContrroller.Login);
router.post("/google", LoginContrroller.googlelogin);
router.post("/github", LoginContrroller.githublogin);

//Update-Profile
router.put("/update-profile", UserMiddleware, AuthController.updateProfile);

//favoriteItem
router.post("/favorite", UserMiddleware, AuthController.favorite);

//SearchUser
router.get("/serchuser", AuthController.SearchUser);

//getfilter Data
router.post("/get-filteruser", UserMiddleware, AuthController.getfilterByUser);

//online user
router.post("/get-onlineuser", AuthController.onlineByUser);

router.get(
  "/lastmessageuser",
  UserMiddleware,
  AuthController.getAllChatsForUser
);

module.exports = router;
