import { Router } from "express";
import { exportUserData, importUserData } from "../storage.js";

const router = Router();

router.get("/", async (req, res) => {
  const data = await exportUserData(req.userId!);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="gmd-export-${new Date().toISOString().split("T")[0]}.json"`);
  res.json(data);
});

router.post("/import", async (req, res) => {
  const data = req.body;
  if (!data || !Array.isArray(data.plans) || !Array.isArray(data.tasks)) {
    return res.status(400).json({ error: "Invalid import data" });
  }
  const result = await importUserData(req.userId!, data);
  res.json(result);
});

export default router;
