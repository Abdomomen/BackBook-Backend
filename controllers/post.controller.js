const User = require("../models/user.model");
const Post = require("../models/post.model");
const Comment = require("../models/comment");
const { asyncWrapper } = require("../middlewares/errors");
const { createNotification } = require("./notification.controller");
const { containsProfanity } = require("../services/profanityFilter");
const fs = require("fs").promises;
const path = require("path");
const exists = require("fs").existsSync;

// =================================//
const createPost = asyncWrapper(async (req, res) => {
  let { title, content, images, comments, role } = req.body;
  if (req.files) {
    images = req.files.map((file) => file.filename);
  }

  if (containsProfanity(title) || containsProfanity(content)) {
    const error = new Error(
      "Your post contains offensive language and cannot be published.",
    );
    error.statusCode = 400;
    throw error;
  }
  const post = new Post({
    title,
    content,
    author: req.user.id,
    images,
    comments,
    role,
  });
  await post.save();
  res.status(201).json({ message: "Post created successfully", post });
});

const updatePost = asyncWrapper(async (req, res) => {
  // Only allow safe fields to be updated
  const { title, content, role } = req.body;

  if (containsProfanity(title) || containsProfanity(content)) {
    const error = new Error(
      "Your update contains offensive language and cannot be saved.",
    );
    error.statusCode = 400;
    throw error;
  }

  const allowedUpdates = {};
  if (title !== undefined) allowedUpdates.title = title;
  if (content !== undefined) allowedUpdates.content = content;
  if (role !== undefined) allowedUpdates.role = role;
  // Merge uploaded files if present
  if (req.files && req.files.length > 0) {
    allowedUpdates.images = req.files.map((file) => file.filename);
  }

  // Atomic: find + authorize + update in one query
  const updatedPost = await Post.findOneAndUpdate(
    { _id: req.params.id, author: req.user.id },
    allowedUpdates,
    { new: true },
  ).populate("author", "username avatar");

  if (!updatedPost) {
    // Either not found or not the owner
    const post = await Post.findById(req.params.id);
    if (!post) {
      const error = new Error("Post not found");
      error.statusCode = 404;
      throw error;
    }
    const error = new Error("You are not authorized to update this post");
    error.statusCode = 403;
    throw error;
  }

  res.status(200).json({ message: "Post updated successfully", updatedPost });
});

const deletePost = asyncWrapper(async (req, res) => {
  const postId = req.params.id;

  // Check post exists first
  const post = await Post.findById(postId);
  if (!post) {
    const error = new Error("Post not found");
    error.statusCode = 404;
    throw error;
  }

  // Authorize: admin or owner
  if (req.user.role !== "admin" && post.author.toString() !== req.user.id) {
    const error = new Error("You are not authorized to delete this post");
    error.statusCode = 403;
    throw error;
  }

  // Delete associated images from storage
  if (post.images && post.images.length > 0) {
    for (const image of post.images) {
      const imagePath = path.join(__dirname, "..", "postImages", image);
      if (exists(imagePath)) {
        try {
          await fs.unlink(imagePath);
        } catch (err) {
          console.error(`Failed to delete image: ${imagePath}`, err);
        }
      }
    }
  }

  // Single cleanup path (DRY)
  await Comment.deleteMany({ post: postId });
  await Post.findByIdAndDelete(postId);
  res.status(200).json({ message: "Post deleted successfully" });
});

const getMyPosts = asyncWrapper(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const query = { author: req.user.id };
  if (req.query.cursor) {
    query.createdAt = { $lt: new Date(req.query.cursor) };
  }
  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("author", "username avatar")
    .lean();

  const postsWithCommentCount = await Promise.all(
    posts.map(async (post) => {
      const commentsCount = await Comment.countDocuments({ post: post._id });
      return { ...post, commentsCount };
    }),
  );

  const nextCursor = posts.length ? posts[posts.length - 1].createdAt : null;
  res.status(200).json({ posts: postsWithCommentCount, nextCursor });
});

const getFriendPosts = asyncWrapper(async (req, res) => {
  const user = await User.findById(req.user.id).select("friends");
  if (!user.friends.includes(req.params.id)) {
    const error = new Error(
      "You are not authorized to see this friend's posts",
    );
    error.statusCode = 403;
    throw error;
  }
  const limit = parseInt(req.query.limit) || 10;
  const query = { author: req.params.id };
  if (req.query.cursor) {
    query.createdAt = { $lt: new Date(req.query.cursor) };
  }
  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("author", "username avatar")
    .lean();

  const postsWithCommentCount = await Promise.all(
    posts.map(async (post) => {
      const commentsCount = await Comment.countDocuments({ post: post._id });
      return { ...post, commentsCount };
    }),
  );

  const nextCursor = posts.length ? posts[posts.length - 1].createdAt : null;
  res.status(200).json({ posts: postsWithCommentCount, nextCursor });
});

const getFriendsPosts = asyncWrapper(async (req, res) => {
  const user = await User.findById(req.user.id).select("friends");
  const limit = parseInt(req.query.limit) || 10;
  // Only include friends' posts in the feed (exclude own posts)
  const query = { author: { $in: user.friends } };
  if (req.query.cursor) {
    query.createdAt = { $lt: new Date(req.query.cursor) };
  }
  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("author", "username avatar")
    .lean();

  const postsWithCommentCount = await Promise.all(
    posts.map(async (post) => {
      const commentsCount = await Comment.countDocuments({ post: post._id });
      return { ...post, commentsCount };
    }),
  );

  const nextCursor = posts.length ? posts[posts.length - 1].createdAt : null;
  res.status(200).json({ posts: postsWithCommentCount, nextCursor });
});

const getAllPosts = asyncWrapper(async (req, res) => {
  if (req.user.role !== "admin") {
    const error = new Error("You are not authorized to get all posts");
    error.statusCode = 403;
    throw error;
  }
  const limit = parseInt(req.query.limit) || 10;
  const query = {};
  if (req.query.cursor) {
    query.createdAt = { $lt: new Date(req.query.cursor) };
  }
  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("author", "username avatar");
  const nextCursor = posts.length ? posts[posts.length - 1].createdAt : null;
  res.status(200).json({ posts, nextCursor });
});

const getPostById = asyncWrapper(async (req, res) => {
  const post = await Post.findById(req.params.id)
    .populate("author", "username avatar")
    .lean();
  if (!post) {
    const error = new Error("Post not found");
    error.statusCode = 404;
    throw error;
  }
  const commentsCount = await Comment.countDocuments({ post: post._id });
  res.status(200).json({ post: { ...post, commentsCount } });
});

const toggleLike = asyncWrapper(async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;

  const post = await Post.findById(postId);
  if (!post) {
    const error = new Error("Post not found");
    error.statusCode = 404;
    throw error;
  }

  const alreadyLiked = post.likes.includes(userId);
  const update = alreadyLiked
    ? { $pull: { likes: userId } }
    : { $addToSet: { likes: userId } };

  const updatedPost = await Post.findByIdAndUpdate(postId, update, {
    new: true,
  });

  // Notify post author on like (not on unlike)
  if (!alreadyLiked) {
    await createNotification(post.author.toString(), userId, "like", postId);
  }

  res.status(200).json({
    likesCount: updatedPost.likes.length,
    isLiked: !alreadyLiked,
  });
});

const searchPosts = asyncWrapper(async (req, res) => {
  const query = req.query.q;
  if (!query) return res.json({ posts: [] });

  const sanitized = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const user = await User.findById(req.user.id).select("friends");
  const visibleAuthors = [req.user.id, ...(user.friends || [])];

  const limit = parseInt(req.query.limit) || 10;
  const searchQuery = {
    author: { $in: visibleAuthors },
    $or: [
      { title: new RegExp(sanitized, "i") },
      { content: new RegExp(sanitized, "i") },
    ],
  };
  if (req.query.cursor) {
    searchQuery.createdAt = { $lt: new Date(req.query.cursor) };
  }

  const posts = await Post.find(searchQuery)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("author", "username avatar");
  const nextCursor = posts.length ? posts[posts.length - 1].createdAt : null;
  res.status(200).json({ posts, nextCursor });
});

module.exports = {
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
};
