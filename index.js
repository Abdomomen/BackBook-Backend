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

// --- CORS Configuration ---
// Normalize URLs by removing trailing slashes
const normalizeUrl = (url) => {
  if (!url) return null;
  return url.replace(/\/$/, "").trim();
};

// Build allowed origins array
const baseOrigins = ["http://localhost:3001"];
if (process.env.CLIENT_URL) {
  const clientUrl = normalizeUrl(process.env.CLIENT_URL);
  baseOrigins.push(clientUrl);
  // Also add without protocol to catch any variations
  const urlWithoutProtocol = clientUrl.replace(/^https?:\/\//, "");
  if (urlWithoutProtocol !== clientUrl) {
    baseOrigins.push(`https://${urlWithoutProtocol}`);
    baseOrigins.push(`http://${urlWithoutProtocol}`);
  }
}

const allowedOrigins = baseOrigins.map(normalizeUrl).filter(Boolean);

// Log allowed origins for debugging
console.log("=== CORS Configuration ===");
console.log("CLIENT_URL from env:", process.env.CLIENT_URL);
console.log("Allowed CORS origins:", allowedOrigins);
console.log("========================");

app.use(
  cors({
    credentials: true,
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) {
        console.log("Request with no origin - allowing");
        return callback(null, true);
      }

      // Normalize the incoming origin
      const normalizedOrigin = normalizeUrl(origin);
      
      // Check if origin is allowed
      if (allowedOrigins.includes(normalizedOrigin)) {
        console.log(`CORS: Allowing origin: ${normalizedOrigin}`);
        callback(null, true);
      } else {
        console.log(`CORS: Blocked origin: ${normalizedOrigin}`);
        console.log(`CORS: Allowed origins are: ${allowedOrigins.join(", ")}`);
        callback(new Error(`Not allowed by CORS. Origin: ${normalizedOrigin}`));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Cookie"],
    exposedHeaders: ["Set-Cookie"],
  }),
);

// 1. Log every request
app.use(morgan("dev"));

// 2. Health Check (Move to top)
app.get("/", (req, res) => {
  console.log(">>> Root route / hit!");
  res.status(200).json({
    status: "alive",
    message: "BackBook API is running perfectly! 🚀",
  });
});

// 4. Middlewares
app.set("trust proxy", 1);
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
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
