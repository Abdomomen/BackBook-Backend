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

// 1. Log every request
app.use((req, res, next) => {
  console.log(`>>> [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 2. Explicitly handle OPTIONS preflight for all routes
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Cookie",
    ],
  }),
);

app.options("*", cors()); // Enable pre-flight for all routes

// 3. Health Check (Move to top)
app.get("/", (req, res) => {
  res
    .status(200)
    .json({
      status: "alive",
      message: "BackBook API is running perfectly! 🚀",
    });
});

// 4. Middlewares
app.set("trust proxy", 1);
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(mongoSanitize());
app.use(hpp());
app.use(compression());

// 5. Routes
const userRouter = require("./routes/user.route");
const postRouter = require("./routes/post.route");
const commentRouter = require("./routes/comment.route");
const notificationRouter = require("./routes/notification.route");

app.use("/api/users", userRouter);
app.use("/api/posts", postRouter);
app.use("/api/comments", commentRouter);
app.use("/api/notifications", notificationRouter);

// 6. Static Files
app.use("/postImages", express.static(path.join(__dirname, "postImages")));
app.use("/userImages", express.static(path.join(__dirname, "userImages")));

// 7. 404 Handler for undefined routes
app.use((req, res) => {
  console.log(`404 ERROR: Path ${req.url} not found`);
  res.status(404).json({ error: "Route not found", path: req.url });
});

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
