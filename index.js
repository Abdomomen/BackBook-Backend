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

// 1. CORS MUST BE FIRST
app.use(
  cors({
    origin: true, // Allow all origins
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

// 2. Trust Proxy for cloud environments
app.set("trust proxy", 1);

// 3. Basic Middlewares
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);
app.use(mongoSanitize());
app.use(hpp());
app.use(compression());

// 4. Health Check (To verify if server is alive)
app.get("/", (req, res) => {
  res.status(200).send("BackBook API is running perfectly! 🚀");
});

// 5. Static Files
app.use("/postImages", express.static(path.join(__dirname, "postImages")));
app.use("/userImages", express.static(path.join(__dirname, "userImages")));

// 6. Routes
const userRouter = require("./routes/user.route");
const postRouter = require("./routes/post.route");
const commentRouter = require("./routes/comment.route");
const notificationRouter = require("./routes/notification.route");
const { globalLimiter } = require("./middlewares/rateLimiters"); // Keep globalLimiter if it's still needed for routes

app.use(globalLimiter); // Apply globalLimiter before routes if it's intended for all routes
app.use("/api/users", userRouter);
app.use("/api/posts", postRouter);
app.use("/api/comments", commentRouter);
app.use("/api/notifications", notificationRouter);

// 7. Error Handling
const { errorHandler } = require("./middlewares/errors");
app.use(errorHandler);

// 8. Connect to DB and Start
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
  }
};

if (require.main === module) {
  connectDB().then(() => {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  });
}

module.exports = app;
