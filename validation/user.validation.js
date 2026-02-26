const {body} = require('express-validator');

const registerValidation = [
    body("username").notEmpty().withMessage("Name is required").isLength({ min: 2 ,max:30 }).withMessage("Name must be at least 2 characters").trim(),
    body("email").isEmail().withMessage("Please provide a valid email").normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];
const loginValidation = [
  body("email").isEmail().withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];

module.exports = { registerValidation, loginValidation };