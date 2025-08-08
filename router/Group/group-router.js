const express = require("express");
const router = express.Router();
const GroupController = require("../../controller/Group/Group-controller");
const UserMiddleware = require("../../middelware/User-middelware");

router.post("/creategroup", UserMiddleware, GroupController.CreateGroup); //Create Group

router.get("/usergroups", UserMiddleware, GroupController.getUserGroups); //Finde Group
router.post("/addmember", UserMiddleware, GroupController.GroupAddmember); //Add Member in Group

router.post("/deletegroup", UserMiddleware, GroupController.DeleteGroup); //Delete Group
router.post("/leavegroup", UserMiddleware, GroupController.LeaveGroup); //Leave Group

module.exports = router;
