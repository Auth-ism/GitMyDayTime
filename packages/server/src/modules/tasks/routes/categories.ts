import { Router, type Request, type Response, type NextFunction } from "express";
import { nanoid } from "nanoid";
import { CreateCategoryInput } from "@gmd/shared";
import { zodMsg } from "../../../validation.js";
import { getUserCategories, createUserCategory, updateUserCategory, deleteUserCategory } from "../storage.js";

const router = Router();

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

router.get("/", wrap(async (req, res) => {
  const categories = await getUserCategories(req.userId!);
  res.json(categories);
}));

router.post("/", wrap(async (req, res) => {
  const input = CreateCategoryInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }
  const category = await createUserCategory(req.userId!, nanoid(8), input.data.name, input.data.color);
  res.status(201).json(category);
}));

router.put("/:id", wrap(async (req, res) => {
  const id = req.params.id as string;
  const updated = await updateUserCategory(req.userId!, id, req.body);
  if (!updated) { res.status(404).json({ error: "Category not found" }); return; }
  res.json(updated);
}));

router.delete("/:id", wrap(async (req, res) => {
  const id = req.params.id as string;
  await deleteUserCategory(req.userId!, id);
  res.status(204).end();
}));

export default router;
