import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import express from "express";
import cors from "cors";
import { authMiddleware, authRouter } from "./auth.js";
import taskRoutes from "./routes/tasks.js";
import planRoutes from "./routes/plan.js";
import statsRoutes from "./routes/stats.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Auth routes (before middleware)
app.use("/api/auth", authRouter);

// Protect all API routes
app.use(authMiddleware);

app.use("/api/days", taskRoutes);
app.use("/api/days", planRoutes);
app.use("/api/stats", statsRoutes);

// Serve frontend in production
const webDist = path.resolve(__dirname, "../../web/dist");
app.use(express.static(webDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
