const jwt = require("jsonwebtoken");

const generateAccessToken = ({ email, id, role }) => {
  return jwt.sign({ email, id, role }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
};

const generateRefreshToken = ({ email, id, role }) => {
  return jwt.sign({ email, id, role }, process.env.REFREASH_TOKEN_JWT, {
    expiresIn: "7d",
  });
};

module.exports = { generateAccessToken, generateRefreshToken };
