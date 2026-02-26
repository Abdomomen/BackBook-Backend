const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const compression = require("compression");
const morgan = require("morgan");
const app = express();
const userRouter = require("./routes/user.route");
const postRouter = require("./routes/post.route");
const commentRouter = require("./routes/comment.route");
const notificationRouter = require("./routes/notification.route");
const { errorHandler } = require("./middlewares/errors");
// connect to database
const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");
  } catch (err) {
    console.log("Error connecting to MongoDB:", err);
  }
};

// --- Security & Basics ---
const allowedOrigins = ["http://localhost:3001", process.env.CLIENT_URL].filter(
  Boolean,
);

app.use(
  cors({
    credentials: true,
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  }),
);
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);
app.use(mongoSanitize());
app.use(hpp());

// --- Static Files ---
const path = require("path");
app.use("/postImages", express.static(path.join(__dirname, "postImages")));
app.use("/userImages", express.static(path.join(__dirname, "userImages")));

// --- Performance Middlewares ---
app.use(compression());
app.use(morgan("combined"));

const { globalLimiter } = require("./middlewares/rateLimiters");

const cookieParser = require("cookie-parser");

// --- Body Parsing ---
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(globalLimiter);

// --- Routes ---
app.use("/api/users", userRouter);
app.use("/api/posts", postRouter);
app.use("/api/comments", commentRouter);
app.use("/api/notifications", notificationRouter);

app.use(errorHandler);
if (require.main === module) {
  connectDB().then(() => {
    app.listen(3000, () => {
      console.log("Server is running on port 3000");
    });
  });
}

module.exports = app;
