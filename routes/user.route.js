const router = require("express");
const verifyJWT = require("../middlewares/verifyJWT");
const userRouter = router.Router();
const upload = require("../middlewares/user.profile");
const { authLimiter } = require("../middlewares/rateLimiters");
const {
  registerValidation,
  loginValidation,
} = require("../validation/user.validation");
const validate = require("../middlewares/validate");
const {
  registerUser,
  loginUser,
  refreshToken,
  friendsList,
  addFriend,
  removeFriend,
  relationalFriends,
  searchUsers,
  deleteUser,
  getFriendsRequests,
  acceptFriendRequest,
  getFriendProfile,
  getCurrentUser,
  suggestedFriends,
  updateProfile,
} = require("../controllers/user.controller");

userRouter.post(
  "/register",
  authLimiter,
  upload.single("avatar"),
  registerValidation,
  validate,
  registerUser,
);
userRouter.post("/login", authLimiter, loginValidation, validate, loginUser);
userRouter.post("/refresh-token", refreshToken);
userRouter.get("/friends", verifyJWT, friendsList);
userRouter.get("/relational-friends", verifyJWT, relationalFriends);
userRouter.get("/suggested", verifyJWT, suggestedFriends);
userRouter.get("/search", verifyJWT, searchUsers);
userRouter.get("/friends-requests", verifyJWT, getFriendsRequests);
userRouter.post("/friends/:friendId", verifyJWT, addFriend);
userRouter.delete("/friends/:friendId", verifyJWT, removeFriend);
userRouter.delete("/delete/:userId", verifyJWT, deleteUser);
userRouter.post(
  "/friends-requests/:requesterId",
  verifyJWT,
  acceptFriendRequest,
);

userRouter.get("/me", verifyJWT, getCurrentUser);
userRouter.get("/profile/:friendId", verifyJWT, getFriendProfile);
userRouter.put("/profile", verifyJWT, upload.single("avatar"), updateProfile);

module.exports = userRouter;
