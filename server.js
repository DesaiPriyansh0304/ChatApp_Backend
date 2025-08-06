require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const connectDB = require("./config/db");
const indexRouter = require("./router/index");
const { initSocket } = require("./utils/Socket.io/index");
// Security Check
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");

const app = express();

// Security Check
app.use(helmet());
app.use(mongoSanitize());
app.use(xss());

// Middleware
app.use(express.json({ limit: "10mb" }));
// app.use(cors());

app.use(
  cors({
    origin: ["http://localhost:5173", "https://chat-vibe-talk.vercel.app"],
    credentials: true,
  })
);

// API Routes
app.use("/api", indexRouter);

// HTTP Server
const server = http.createServer(app);

connectDB().then(() => {
  initSocket(server); // Init socket after DB connected

  const PORT = process.env.PORT || 8000;
  server.listen(PORT, () => {
    console.log(`🚀 Server running on PORT ${PORT}`);
  });
});
