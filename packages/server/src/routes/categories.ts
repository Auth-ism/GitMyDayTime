import { Router } from "express";
import { nanoid } from "nanoid";
import { CreateCategoryInput } from "@gmd/shared";
import { getUserCategories, createUserCategory, updateUserCategory, deleteUserCategory } from "../storage.js";

const router = Router();

router.get("/", async (req, res) => {
  const categories = await getUserCategories(req.userId!);
  res.json(categories);
});

router.post("/", async (req, res) => {
  const input = CreateCategoryInput.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: input.error });
  const category = await createUserCategory(req.userId!, nanoid(8), input.data.name, input.data.color);
  res.status(201).json(category);
});

router.put("/:id", async (req, res) => {
  const updated = await updateUserCategory(req.userId!, req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Category not found" });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  await deleteUserCategory(req.userId!, req.params.id);
  res.status(204).end();
});

export default router;
