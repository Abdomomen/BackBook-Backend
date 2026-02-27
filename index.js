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

// 1. CORS - Allow ALL origins (origin: true)
app.use(cors({ origin: true, credentials: true }));
app.options("*", cors({ origin: true, credentials: true }));

// 2. Trust proxy for Back4app
app.set("trust proxy", 1);

// 3. Logging
app.use(morgan("dev"));

// 4. Body parsing & cookies
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

// 5. Security
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(mongoSanitize());
app.use(hpp());
app.use(compression());

// 6. Health check
app.get("/", (req, res) => {
  res.json({ status: "alive", message: "BackBook API is running! 🚀" });
});

// 7. Static files
app.use("/postImages", express.static(path.join(__dirname, "postImages")));
app.use("/userImages", express.static(path.join(__dirname, "userImages")));

// 8. Routes
const userRouter = require("./routes/user.route");
const postRouter = require("./routes/post.route");
const commentRouter = require("./routes/comment.route");
const notificationRouter = require("./routes/notification.route");

app.use("/api/users", userRouter);
app.use("/api/posts", postRouter);
app.use("/api/comments", commentRouter);
app.use("/api/notifications", notificationRouter);

// 9. Error handling
const { errorHandler } = require("./middlewares/errors");
app.use(errorHandler);

// 10. Connect & start
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
};

connectDB().then(() => {
  const port = process.env.PORT || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
  });
});

module.exports = app;
