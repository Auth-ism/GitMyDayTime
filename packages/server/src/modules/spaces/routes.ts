// routes/spaces.ts — Space API routes
// UI integration is deferred. Routes are mounted and functional for future frontend wiring.

import { Router } from "express";
import { CreateSpaceInput, UpdateSpaceInput } from "@gmd/shared";
import {
  getUserSpaces, getSpace, createSpace, updateSpace, deleteSpace,
  getSpaceMembers, getSpaceMemberRole, addSpaceMember, removeSpaceMember,
  assignProjectToSpace,
} from "./storage.js";

const router = Router();

function zodMsg(err: any): string {
  return err.errors?.[0]?.message ?? "Geçersiz istek";
}

function wrap(fn: (req: any, res: any) => Promise<void>) {
  return (req: any, res: any, next: any) => fn(req, res).catch(next);
}

// ── Auth helpers ──────────────────────────────────────────────────

async function requireSpaceOwnerOrAdmin(spaceId: string, userId: string, res: any): Promise<string | null> {
  const role = await getSpaceMemberRole(spaceId, userId);
  if (!role || (role !== "owner" && role !== "admin")) {
    res.status(403).json({ error: "Yetki yok" });
    return null;
  }
  return role;
}

// ── Routes ────────────────────────────────────────────────────────

// List my spaces
router.get("/", wrap(async (req, res) => {
  const spaces = await getUserSpaces(req.userId!);
  res.json(spaces);
}));

// Get single space
router.get("/:id", wrap(async (req, res) => {
  const space = await getSpace(req.params.id);
  if (!space) { res.status(404).json({ error: "Space bulunamadı" }); return; }
  const role = await getSpaceMemberRole(req.params.id, req.userId!);
  if (!role) { res.status(403).json({ error: "Yetki yok" }); return; }
  res.json({ ...space, myRole: role });
}));

// Create space
router.post("/", wrap(async (req, res) => {
  const input = CreateSpaceInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }
  const space = await createSpace(
    input.data.name,
    input.data.slug,
    req.userId!,
    input.data.description,
    input.data.icon,
    input.data.color
  );
  res.status(201).json(space);
}));

// Update space (owner/admin only)
router.patch("/:id", wrap(async (req, res) => {
  const role = await requireSpaceOwnerOrAdmin(req.params.id, req.userId!, res);
  if (!role) return;
  const input = UpdateSpaceInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }
  const space = await updateSpace(req.params.id, input.data);
  res.json(space);
}));

// Delete space (owner only)
router.delete("/:id", wrap(async (req, res) => {
  const space = await getSpace(req.params.id);
  if (!space) { res.status(404).json({ error: "Space bulunamadı" }); return; }
  if (space.ownerId !== req.userId) { res.status(403).json({ error: "Yalnızca sahip silebilir" }); return; }
  await deleteSpace(req.params.id);
  res.json({ ok: true });
}));

// List space members
router.get("/:id/members", wrap(async (req, res) => {
  const role = await getSpaceMemberRole(req.params.id, req.userId!);
  if (!role) { res.status(403).json({ error: "Yetki yok" }); return; }
  const members = await getSpaceMembers(req.params.id);
  res.json(members);
}));

// Add member (owner/admin)
router.post("/:id/members", wrap(async (req, res) => {
  const adminRole = await requireSpaceOwnerOrAdmin(req.params.id, req.userId!, res);
  if (!adminRole) return;
  const { userId, role } = req.body as { userId: string; role?: string };
  if (!userId) { res.status(400).json({ error: "userId gerekli" }); return; }
  await addSpaceMember(req.params.id, userId, role ?? "member");
  res.status(201).json({ ok: true });
}));

// Remove member (owner/admin)
router.delete("/:id/members/:userId", wrap(async (req, res) => {
  const adminRole = await requireSpaceOwnerOrAdmin(req.params.id, req.userId!, res);
  if (!adminRole) return;
  await removeSpaceMember(req.params.id, req.params.userId);
  res.json({ ok: true });
}));

// Assign project to space
router.post("/:id/projects/:projectId", wrap(async (req, res) => {
  const role = await requireSpaceOwnerOrAdmin(req.params.id, req.userId!, res);
  if (!role) return;
  await assignProjectToSpace(req.params.projectId, req.params.id);
  res.json({ ok: true });
}));

// Remove project from space
router.delete("/:id/projects/:projectId", wrap(async (req, res) => {
  const role = await requireSpaceOwnerOrAdmin(req.params.id, req.userId!, res);
  if (!role) return;
  await assignProjectToSpace(req.params.projectId, null);
  res.json({ ok: true });
}));

export default router;
