import { Router, type Request, type Response, type NextFunction } from "express";
import { CreateTemplateInput } from "@gmd/shared";
import { zodMsg } from "../../../validation.js";
import { getTemplates, createTemplate, deleteTemplate } from "../storage.js";

const router = Router();

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

router.get("/", wrap(async (req, res) => {
  const templates = await getTemplates(req.userId!);
  res.json(templates);
}));

router.post("/", wrap(async (req, res) => {
  const input = CreateTemplateInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }
  const template = await createTemplate(req.userId!, input.data);
  res.status(201).json(template);
}));

router.delete("/:id", wrap(async (req, res) => {
  await deleteTemplate(req.userId!, req.params.id as string);
  res.status(204).end();
}));

export default router;
