const User = require("../models/user.model");
const Post = require("../models/post.model");
const Comment = require("../models/comment");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { asyncWrapper } = require("../middlewares/errors");
const { createNotification } = require("./notification.controller");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../services/jwtProvider");
const fs = require("fs").promises;
const path = require("path");
const exists = require("fs").existsSync;

// --- Helper: send tokens ---
const sendTokens = (res, user) => {
  const payload = { email: user.email, id: user._id, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return accessToken;
};

// Controllers://
// ========================//
const registerUser = asyncWrapper(async (req, res) => {
  let { username, email, password, avatar } = req.body;
  if (req.file) {
    avatar = req.file.filename;
  }
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const error = new Error("Email already in use");
    error.statusCode = 400; // Bad Req
    throw error;
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({
    username,
    email,
    password: hashedPassword,
    avatar,
  });
  await user.save();
  const accessToken = sendTokens(res, user);
  res
    .status(201)
    .json({ message: "User registered successfully", token: accessToken });
});

//==================================//
const loginUser = asyncWrapper(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }
  const accessToken = sendTokens(res, user);
  res.json({ message: "Login successful", token: accessToken });
});

// =============================//

const refreshToken = asyncWrapper(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    const error = new Error("No refresh token provided");
    error.statusCode = 401;
    throw error;
  }
  const decoded = jwt.verify(token, process.env.REFREASH_TOKEN_JWT);
  const user = await User.findById(decoded.id);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 401;
    throw error;
  }
  // Token Rotation: clear old cookie, issue brand new pair
  res.clearCookie("refreshToken");
  const accessToken = sendTokens(res, user);
  res.json({ message: "Token refreshed", token: accessToken });
});

// =============================//
const friendsList = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const user = await User.findById(userId).populate(
    "friends",
    "username email avatar",
  );
  res.json({ friends: user.friends });
});

// =============================//
const addFriend = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const friendId = req.params.friendId;
  if (userId === friendId) {
    const error = new Error("You cannot add yourself as a friend");
    error.statusCode = 400;
    throw error;
  }
  const user = await User.findById(userId);
  const friend = await User.findById(friendId);
  if (!friend) {
    const error = new Error("Friend not found");
    error.statusCode = 404;
    throw error;
  }
  if (user.friends.includes(friendId)) {
    const error = new Error("Friend already added");
    error.statusCode = 400;
    throw error;
  }
  await User.findByIdAndUpdate(friendId, {
    $addToSet: { friendsrequests: userId },
  });

  // Notify the target user about the friend request
  await createNotification(friendId, userId, "friend_request");

  res.json({ message: "Friend request sent successfully" });
});
// =================================//
const removeFriend = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const friendId = req.params.friendId;
  const user = await User.findById(userId);
  if (!user.friends.includes(friendId)) {
    const error = new Error("Friend not in your friends list");
    error.statusCode = 400;
    throw error;
  }
  // Atomic $pull for both sides
  await User.updateOne({ _id: userId }, { $pull: { friends: friendId } });
  await User.updateOne({ _id: friendId }, { $pull: { friends: userId } });
  res.json({ message: "Friend removed successfully" });
});

// ==============================//
const relationalFriends = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const user = await User.findById(userId).populate({
    path: "friends",
    select: "username email avatar",
  });
  const friendsOfFriends = await User.find({
    _id: { $in: user.friends.map((friend) => friend._id) },
    friends: { $ne: userId },
  }).select("username email avatar");
  res.json({ friendsOfFriends });
});

// =============================//
const searchUsers = asyncWrapper(async (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.json({ users: [] });
  }
  // Escape special regex characters to prevent ReDoS
  const sanitized = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const users = await User.find({
    username: new RegExp(sanitized, "i"),
  }).select("username email avatar");
  res.json({ users });
});
// =============================//

const deleteUser = asyncWrapper(async (req, res) => {
  const role = req.user.role;
  if (role !== "admin") {
    const error = new Error("You do not have permission to delete users");
    error.statusCode = 403;
    throw error;
  }
  const userId = req.params.userId;
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  // Remove user from all friends' lists in one operation
  await User.updateMany(
    { _id: { $in: user.friends } },
    { $pull: { friends: userId } },
  );

  // Delete all user posts
  await Post.deleteMany({ _id: { $in: user.posts } });

  await Comment.deleteMany({ author: userId });

  // Avatar Cleanup
  if (user.avatar && !user.avatar.startsWith("http")) {
    const avatarPath = path.join(__dirname, "../userImages/", user.avatar);
    if (exists(avatarPath)) {
      await fs.unlink(avatarPath).catch(() => {});
    }
  }

  await User.findByIdAndDelete(userId);
  res.json({ message: "User deleted successfully" });
});

const updateProfile = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const { username, bio } = req.body;
  const updateData = {};

  if (username) updateData.username = username;
  if (bio !== undefined) updateData.bio = bio;

  if (req.file) {
    const user = await User.findById(userId);
    // Cleanup old avatar
    if (user.avatar && !user.avatar.startsWith("http")) {
      const oldAvatarPath = path.join(__dirname, "../userImages/", user.avatar);
      if (exists(oldAvatarPath)) {
        await fs.unlink(oldAvatarPath).catch(() => {});
      }
    }
    updateData.avatar = req.file.filename;
  }

  const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
  }).select("-password");

  res.json({ message: "Profile updated successfully", user: updatedUser });
});

// =================================//
const getFriendsRequests = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const user = await User.findById(userId).populate(
    "friendsrequests",
    "username email avatar",
  );
  res.json({ friendsRequests: user.friendsrequests });
});

// =================================//
const acceptFriendRequest = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const requesterId = req.params.requesterId;
  const user = await User.findById(userId);
  const requester = await User.findById(requesterId);

  if (req.body.method !== "accept") {
    await User.findByIdAndUpdate(userId, {
      $pull: { friendsrequests: requesterId },
    });
    res.json({ message: "Friend request rejected successfully" });
    return;
  }

  if (!requester) {
    const error = new Error("Requester not found");
    error.statusCode = 404;
    throw error;
  }
  if (!user.friendsrequests.includes(requesterId)) {
    const error = new Error("No friend request from this user");
    error.statusCode = 400;
    throw error;
  }

  await User.findByIdAndUpdate(userId, {
    $addToSet: { friends: requesterId },
    $pull: { friendsrequests: requesterId },
  });
  await User.findByIdAndUpdate(requesterId, {
    $addToSet: { friends: userId },
  });

  res.json({ message: "Friend request accepted successfully" });
});

// ================================//
const getFriendProfile = asyncWrapper(async (req, res) => {
  const friendId = req.params.friendId;
  const user = await User.findById(req.user.id);
  if (!user.friends.includes(friendId)) {
    const error = new Error("This user is not your friend");
    error.statusCode = 403;
    throw error;
  }
  // Whitelist fields to prevent data leakage
  const friend = await User.findById(friendId).select(
    "username email avatar friends bio",
  );
  res.json({ friend });
});
// ================================//

const getCurrentUser = asyncWrapper(async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json({ user });
});

// ================================//
const suggestedFriends = asyncWrapper(async (req, res) => {
  const mongoose = require("mongoose");
  const userId = req.user.id;
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // 1. Get current user's profile to know friends and incoming requests
  const user = await User.findById(userId).select("friends friendsrequests");

  // 2. Find people user already sent requests to (outgoing)
  const outgoingRequests = await User.find({
    friendsrequests: userObjectId,
  }).select("_id");
  const outgoingIds = outgoingRequests.map((u) => u._id);

  const friendsIds = user.friends.map((id) => new mongoose.Types.ObjectId(id));
  const incomingIds = user.friendsrequests.map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  // Combined all IDs to exclude for any query
  const excludeObjectIds = [
    userObjectId,
    ...friendsIds,
    ...incomingIds,
    ...outgoingIds,
  ];

  let suggestions = [];

  // STRATEGY A: Friends of Friends (Mutual Friends)
  const fof = await User.aggregate([
    { $match: { _id: { $in: friendsIds } } }, // Match my friends
    { $unwind: "$friends" }, // Get their friends
    // Exclude myself and people I'm already connected with
    { $match: { friends: { $nin: excludeObjectIds } } },
    { $group: { _id: "$friends", mutualCount: { $sum: 1 } } }, // Count mutuals
    { $sort: { mutualCount: -1 } },
    { $limit: 15 },
  ]);

  if (fof.length > 0) {
    const fofIds = fof.map((f) => f._id);
    const fofUsers = await User.find({ _id: { $in: fofIds } }).select(
      "username avatar createdAt friends",
    );

    // Build lookup for mutual counts
    const mutualCountMap = {};
    fof.forEach((f) => {
      mutualCountMap[f._id.toString()] = f.mutualCount;
    });

    suggestions = fofUsers.map((u) => ({
      ...u.toObject(),
      reason: "Mutual Friends",
      mutualCount: mutualCountMap[u._id.toString()],
    }));
  }

  // STRATEGY B: New Users or Users with few friends (Cold Start)
  if (suggestions.length < 10) {
    const existingSuggestionIds = suggestions.map(
      (s) => new mongoose.Types.ObjectId(s._id),
    );
    const allExcluded = [...excludeObjectIds, ...existingSuggestionIds];

    const additionalUsers = await User.find({
      _id: { $nin: allExcluded },
    })
      .sort({ createdAt: -1 }) // Newest first
      .limit(15)
      .select("username avatar createdAt friends");

    const mappedAdditional = additionalUsers.map((u) => ({
      ...u.toObject(),
      reason: u.friends.length < 3 ? "New to BackBook" : "People you may know",
    }));

    suggestions = [...suggestions, ...mappedAdditional];
  }

  res.json({ users: suggestions.slice(0, 20) });
});

module.exports = {
  registerUser,
  loginUser,
  refreshToken,
  friendsList,
  addFriend,
  removeFriend,
  relationalFriends,
  searchUsers,
  updateProfile,
  deleteUser,
  getFriendsRequests,
  acceptFriendRequest,
  getFriendProfile,
  getCurrentUser,
  suggestedFriends,
};
