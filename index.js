const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const compression = require("compression");
const morgan = require("morgan");
const mongoose = require("mongoose");
const path = require("path");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();

// 1. Log every request to see if it reaches the server
app.use((req, res, next) => {
  console.log(`>>> Incoming Request: ${req.method} ${req.url}`);
  next();
});

// 2. Permissive CORS for debugging
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

// 3. Trust Proxy for Back4app
app.set("trust proxy", 1);

// 4. Middlewares
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(mongoSanitize());
app.use(hpp());
app.use(compression());

// 5. Health Check at Root
app.get("/", (req, res) => {
  res.status(200).send("BackBook API is running perfectly! 🚀");
});

// 6. Static Files
app.use("/postImages", express.static(path.join(__dirname, "postImages")));
app.use("/userImages", express.static(path.join(__dirname, "userImages")));

// 7. Routes (No rate limiters for now to eliminate variables)
const userRouter = require("./routes/user.route");
const postRouter = require("./routes/post.route");
const commentRouter = require("./routes/comment.route");
const notificationRouter = require("./routes/notification.route");

app.use("/api/users", userRouter);
app.use("/api/posts", postRouter);
app.use("/api/comments", commentRouter);
app.use("/api/notifications", notificationRouter);

// 8. Error Handling
const { errorHandler } = require("./middlewares/errors");
app.use(errorHandler);

// 9. Startup
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("SUCCESS: Connected to MongoDB");
  } catch (err) {
    console.error("ERROR: MongoDB Connection Failed:", err);
  }
};

connectDB().then(() => {
  const port = process.env.PORT || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`SUCCESS: Server is running on port ${port}`);
  });
});

module.exports = app;
