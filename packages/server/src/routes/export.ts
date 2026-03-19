import { Router } from "express";
import { exportUserData } from "../storage.js";

const router = Router();

router.get("/", async (req, res) => {
  const data = await exportUserData(req.userId!);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="gmd-export-${new Date().toISOString().split("T")[0]}.json"`);
  res.json(data);
});

export default router;
