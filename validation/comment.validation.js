const {body}= require("express-validator")

const comment=[
    body("body").notEmpty().withMessage("Comment body is required"),
    body("post").notEmpty().withMessage("Comment post is required"),
]

module.exports={comment}