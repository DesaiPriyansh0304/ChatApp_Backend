require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
// Security Check
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
//router import
const indexRouter = require("./router/index");
//socket import
const { initSocket } = require("./utils/Socket.io/index");
const connectDB = require("./config/db");

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
const PORT = process.env.PORT || 8000;

connectDB().then(() => {
  initSocket(server); // Init socket after DB connected

  server.listen(PORT, () => {
    console.log(`🚀 Server running on PORT ${PORT}`);
  });
});
