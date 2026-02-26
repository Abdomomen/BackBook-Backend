const express = require("express");
const notificationRouter = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
} = require("../controllers/notification.controller");
const verifyJWT = require("../middlewares/verifyJWT");

notificationRouter.get("/", verifyJWT, getNotifications);
notificationRouter.put("/read-all", verifyJWT, markAllAsRead);
notificationRouter.put("/:id/read", verifyJWT, markAsRead);

module.exports = notificationRouter;
