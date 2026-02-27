const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const compression = require("compression");
const morgan = require("morgan");
const app = express();
app.set("trust proxy", 1); // Trust first proxy (Back4app uses a load balancer)
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
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow all origins for now to fix the blockage, then we will restrict.
      // This is the most reliable way to debug if CORS is the real issue.
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
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
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  });
}

module.exports = app;
