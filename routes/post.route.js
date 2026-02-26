const router = require("express");
const postRouter = router.Router();
const {
  createPost,
  updatePost,
  deletePost,
  getMyPosts,
  getFriendsPosts,
  getAllPosts,
  getFriendPosts,
  getPostById,
  toggleLike,
  searchPosts,
} = require("../controllers/post.controller");
const verifyJWT = require("../middlewares/verifyJWT");
const postValidation = require("../validation/post.validation");
const upload = require("../middlewares/postUploader");
const validate = require("../middlewares/validate");

postRouter.post(
  "/",
  verifyJWT,
  upload.array("images", 10),
  postValidation,
  validate,
  createPost,
);
postRouter.put(
  "/:id",
  verifyJWT,
  upload.array("images", 10),
  postValidation,
  validate,
  updatePost,
);
postRouter.delete("/:id", verifyJWT, deletePost);
postRouter.get("/friends", verifyJWT, getFriendsPosts);
postRouter.get("/all", verifyJWT, getAllPosts);
postRouter.get("/userPosts", verifyJWT, getMyPosts);
postRouter.get("/search", verifyJWT, searchPosts);
postRouter.get("/single/:id", verifyJWT, getPostById);
postRouter.post("/:id/like", verifyJWT, toggleLike);
postRouter.get("/:id", verifyJWT, getFriendPosts);

module.exports = postRouter;
