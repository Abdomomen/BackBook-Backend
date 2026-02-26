const Comment = require("../models/comment");
const Post = require("../models/post.model");
const { asyncWrapper } = require("../middlewares/errors");
const { createNotification } = require("./notification.controller");
const { containsProfanity } = require("../services/profanityFilter");

const createComment = asyncWrapper(async (req, res) => {
  const { body, post } = req.body;

  if (containsProfanity(body)) {
    const error = new Error("Comment contains offensive language.");
    error.statusCode = 400;
    throw error;
  }
  const comment = new Comment({
    body,
    author: req.user.id,
    post,
  });
  await comment.save();

  // Notify post author about the new comment
  const postDoc = await Post.findById(req.body.post).select("author");
  if (postDoc) {
    await createNotification(
      postDoc.author.toString(),
      req.user.id,
      "comment",
      postDoc._id,
    );
  }

  res.status(201).json({ message: "Comment created successfully", comment });
});

const updateComment = asyncWrapper(async (req, res) => {
  const { body } = req.body;

  if (containsProfanity(body)) {
    const error = new Error("Update contains offensive language.");
    error.statusCode = 400;
    throw error;
  }

  // Atomic: find + authorize + update in one query (only body field allowed)
  const updatedComment = await Comment.findOneAndUpdate(
    { _id: req.params.id, author: req.user.id },
    { body },
    { new: true },
  ).populate("author", "username avatar");

  if (!updatedComment) {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      const error = new Error("Comment not found");
      error.statusCode = 404;
      throw error;
    }
    const error = new Error("You are not authorized to update this comment");
    error.statusCode = 403;
    throw error;
  }

  res
    .status(200)
    .json({ message: "Comment updated successfully", updatedComment });
});

const deleteComment = asyncWrapper(async (req, res) => {
  // DRY: single path — admin can delete any, user can only delete own
  const condition = { _id: req.params.id };
  if (req.user.role !== "admin") {
    condition.author = req.user.id;
  }

  // Atomic: find + authorize + delete in one query
  const deleted = await Comment.findOneAndDelete(condition);
  if (!deleted) {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      const error = new Error("Comment not found");
      error.statusCode = 404;
      throw error;
    }
    const error = new Error("You are not authorized to delete this comment");
    error.statusCode = 403;
    throw error;
  }

  res.status(200).json({ message: "Comment deleted successfully" });
});

const getComments = asyncWrapper(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const query = { post: req.params.id };
  if (req.query.cursor) {
    query.createdAt = { $lt: new Date(req.query.cursor) };
  }
  const comments = await Comment.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("author", "username avatar");
  const nextCursor = comments.length
    ? comments[comments.length - 1].createdAt
    : null;
  res.status(200).json({ comments, nextCursor });
});

module.exports = {
  createComment,
  updateComment,
  deleteComment,
  getComments,
};
