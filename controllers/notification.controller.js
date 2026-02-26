const Notification = require("../models/notification.model");
const { asyncWrapper } = require("../middlewares/errors");

// Helper: create a notification (called from other controllers)
const createNotification = async (
  recipientId,
  senderId,
  type,
  postId = null,
) => {
  // Don't notify yourself
  if (recipientId.toString() === senderId.toString()) return;
  await Notification.create({
    recipient: recipientId,
    sender: senderId,
    type,
    post: postId,
  });
};

const getNotifications = asyncWrapper(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const query = { recipient: req.user.id };
  if (req.query.cursor) {
    query.createdAt = { $lt: new Date(req.query.cursor) };
  }
  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("sender", "username avatar")
    .populate("post", "title");
  const unreadCount = await Notification.countDocuments({
    recipient: req.user.id,
    read: false,
  });
  const nextCursor = notifications.length
    ? notifications[notifications.length - 1].createdAt
    : null;
  res.status(200).json({ notifications, unreadCount, nextCursor });
});

const markAsRead = asyncWrapper(async (req, res) => {
  await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user.id },
    { read: true },
  );
  res.status(200).json({ message: "Notification marked as read" });
});

const markAllAsRead = asyncWrapper(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user.id, read: false },
    { read: true },
  );
  res.status(200).json({ message: "All notifications marked as read" });
});

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
};
