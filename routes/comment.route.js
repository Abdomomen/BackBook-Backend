const express = require("express");
const commentRouter = express.Router();
const {
  createComment,
  updateComment,
  deleteComment,
  getComments,
} = require("../controllers/comment.controller");
const verifyJWT = require("../middlewares/verifyJWT");
const { comment } = require("../validation/comment.validation");
const validate = require("../middlewares/validate");

commentRouter.post("/", verifyJWT, comment, validate, createComment);
commentRouter.put("/:id", verifyJWT, comment, validate, updateComment);
commentRouter.delete("/:id", verifyJWT, deleteComment);
commentRouter.get("/:id", verifyJWT, getComments);

module.exports = commentRouter;
