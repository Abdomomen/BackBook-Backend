const {body}=require("express-validator")

const postValidation=[
    body("title").notEmpty().withMessage("Title is required"),
    body("content").notEmpty().withMessage("Content is required"),
    body("images").optional(),
]

module.exports= postValidation