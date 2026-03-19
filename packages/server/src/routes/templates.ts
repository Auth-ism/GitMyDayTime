import { Router } from "express";
import { CreateTemplateInput } from "@gmd/shared";
import { getTemplates, createTemplate, deleteTemplate } from "../storage.js";

const router = Router();

router.get("/", async (req, res) => {
  const templates = await getTemplates(req.userId!);
  res.json(templates);
});

router.post("/", async (req, res) => {
  const input = CreateTemplateInput.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: input.error });
  const template = await createTemplate(req.userId!, input.data);
  res.status(201).json(template);
});

router.delete("/:id", async (req, res) => {
  await deleteTemplate(req.userId!, req.params.id);
  res.status(204).end();
});

export default router;
