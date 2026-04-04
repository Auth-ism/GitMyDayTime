import crypto from "node:crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import { pool } from "../db.js";
import {
  CreateProjectInput, UpdateProjectInput,
  CreateIssueInput, UpdateIssueInput,
  CreateCommentInput,
  InviteMemberInput, UpdateMemberRoleInput, TransferOwnerInput,
  AddToPlanInput,
  type ProjectRole,
} from "@gmd/shared";
import { zodMsg } from "../validation.js";
import { sendProjectInvitationEmail } from "../email.js";
import { publishProjectEvent, subscribeProjectEvents } from "../redis.js";
import {
  getMemberRole, ROLE_HIERARCHY,
  createProject, getUserProjects, getProject, updateProject, deleteProject,
  getProjectMembers, createInvitation, getInvitationByToken, acceptInvitation,
  removeMember, updateMemberRole, transferOwnership, getMemberCount, getUserProjectCount,
  getWorkflowStatuses, getDefaultStatus,
  createWorkflowStatus, updateWorkflowStatus, deleteWorkflowStatus,
  createIssue, getIssues, getIssueById, updateIssue, archiveIssue,
  getBoardData, invalidateBoardCache,
  getIssueDetail, invalidateIssueCache,
  getIssueComments, addComment, updateComment, deleteComment, getComment,
  addIssueToPlan, removeIssueFromPlan, getMyAssignments,
  enqueueProjectNotification,
  invalidateAllMemberCaches,
  getIssueLinks, createIssueLink, deleteIssueLink,
  getProjectLabels,
} from "../storage/projects.js";

// ─────────────────────────────────────────────────────────────────
// Extend Express Request
// ─────────────────────────────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      projectRole?: ProjectRole;
      projectId?: string;
    }
  }
}

const router = Router();

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// ─────────────────────────────────────────────────────────────────
// RBAC Middleware
// ─────────────────────────────────────────────────────────────────
function requireProjectMembership(minRole: ProjectRole = "viewer") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const projectId = (req.params.id || req.params.projectId) as string;
    if (!projectId) { res.status(400).json({ error: "Proje ID gerekli" }); return; }

    const role = await getMemberRole(projectId, req.userId!);
    if (!role) { res.status(403).json({ error: "Bu projeye erişim yetkiniz yok" }); return; }

    if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minRole]) {
      res.status(403).json({ error: "Bu işlem için yetkiniz yok" }); return;
    }

    req.projectRole = role;
    req.projectId = projectId;
    next();
  };
}

const isMember = requireProjectMembership("viewer");
const canReport = requireProjectMembership("reporter");
const isDev = requireProjectMembership("developer");
const isAdmin = requireProjectMembership("admin");
const isOwner = requireProjectMembership("owner");

// ─────────────────────────────────────────────────────────────────
// My Assignments (no project context needed)
// ─────────────────────────────────────────────────────────────────
router.get("/my-assignments", wrap(async (req, res) => {
  const date = typeof req.query.date === "string" ? req.query.date : undefined;
  const assignments = await getMyAssignments(req.userId!, date);
  res.json(assignments);
}));

// ─────────────────────────────────────────────────────────────────
// Join via invitation token
// ─────────────────────────────────────────────────────────────────
router.get("/join/:token", wrap(async (req, res) => {
  const token = req.params.token as string;
  const inv = await getInvitationByToken(token);
  if (!inv)              { res.status(404).json({ error: "Davet bulunamadı veya geçersiz" }); return; }
  if (inv.acceptedAt)    { res.status(409).json({ error: "Bu davet zaten kabul edildi" }); return; }
  if (inv.expiresAt < new Date()) { res.status(410).json({ error: "Davet süresi dolmuş" }); return; }

  const { rows: userRows } = await pool.query(
    "SELECT email FROM users WHERE id = $1", [req.userId]
  );
  if (userRows[0]?.email?.toLowerCase() !== inv.invitedEmail.toLowerCase()) {
    res.status(403).json({ error: "Bu davet başka bir e-posta adresine gönderildi" }); return;
  }

  const existing = await getMemberRole(inv.projectId, req.userId!);
  if (existing) { res.status(409).json({ error: "Zaten bu projenin üyesisiniz" }); return; }

  const count = await getMemberCount(inv.projectId);
  if (count >= 50) { res.status(422).json({ error: "Proje üye limitine ulaşılmış (50)" }); return; }

  await acceptInvitation(inv.id, req.userId!, inv.invitedRole, inv.projectId);
  await publishProjectEvent(inv.projectId, { type: "member_joined", userId: req.userId });

  res.json({ projectId: inv.projectId, projectName: inv.projectName });
}));

// ─────────────────────────────────────────────────────────────────
// Projects CRUD
// ─────────────────────────────────────────────────────────────────
router.get("/", wrap(async (req, res) => {
  const projects = await getUserProjects(req.userId!);
  res.json(projects);
}));

router.post("/", wrap(async (req, res) => {
  const input = CreateProjectInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }

  const count = await getUserProjectCount(req.userId!);
  if (count >= 20) { res.status(422).json({ error: "En fazla 20 proje oluşturabilirsiniz" }); return; }

  const project = await createProject(req.userId!, {
    name: input.data.name,
    projectKey: input.data.projectKey,
    description: input.data.description,
    boardType: input.data.boardType,
  });
  res.status(201).json(project);
}));

router.get("/:id", isMember, wrap(async (req, res) => {
  const id = req.params.id as string;
  const data = await getProject(id, req.userId!);
  if (!data) { res.status(404).json({ error: "Proje bulunamadı" }); return; }
  res.json(data);
}));

router.put("/:id", isAdmin, wrap(async (req, res) => {
  const input = UpdateProjectInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }
  const updated = await updateProject(req.params.id as string, input.data);
  if (!updated) { res.status(404).json({ error: "Proje bulunamadı" }); return; }
  res.json(updated);
}));

router.delete("/:id", isOwner, wrap(async (req, res) => {
  await deleteProject(req.params.id as string);
  res.json({ ok: true });
}));

// ─────────────────────────────────────────────────────────────────
// Members
// ─────────────────────────────────────────────────────────────────
router.post("/:id/invitations", isAdmin, wrap(async (req, res) => {
  const id = req.params.id as string;
  const input = InviteMemberInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }

  const count = await getMemberCount(id);
  if (count >= 50) { res.status(422).json({ error: "Üye limiti dolmuş (50)" }); return; }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const { id: invId, expiresAt } = await createInvitation(
    id, req.userId!, input.data.email, input.data.role, rawToken
  );

  const projectData = await getProject(id, req.userId!);
  await sendProjectInvitationEmail(
    input.data.email,
    projectData?.name ?? "GMD Project",
    rawToken
  ).catch(() => {});

  res.json({ ok: true, invitationId: invId, expiresAt });
}));

router.delete("/:id/leave", isMember, wrap(async (req, res) => {
  const id = req.params.id as string;
  if (req.projectRole === "owner") {
    res.status(400).json({ error: "Sahipliği devretmeden projeden ayrılamazsınız" }); return;
  }
  await removeMember(id, req.userId!);
  await publishProjectEvent(id, { type: "member_left", userId: req.userId });
  res.json({ ok: true });
}));

router.delete("/:id/members/:userId", isMember, wrap(async (req, res) => {
  const id = req.params.id as string;
  const targetId = req.params.userId as string;
  const targetRole = await getMemberRole(id, targetId);
  if (!targetRole) { res.status(404).json({ error: "Üye bulunamadı" }); return; }

  const myLevel = ROLE_HIERARCHY[req.projectRole!];
  const targetLevel = ROLE_HIERARCHY[targetRole];
  if (myLevel <= targetLevel) {
    res.status(403).json({ error: "Bu üyeyi çıkarma yetkiniz yok" }); return;
  }

  await removeMember(id, targetId);
  await publishProjectEvent(id, { type: "member_left", userId: targetId });
  res.json({ ok: true });
}));

router.patch("/:id/members/:userId", isOwner, wrap(async (req, res) => {
  const id = req.params.id as string;
  const input = UpdateMemberRoleInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }

  const updated = await updateMemberRole(id, req.params.userId as string, input.data.role);
  if (!updated) { res.status(404).json({ error: "Üye bulunamadı" }); return; }
  res.json(updated);
}));

router.post("/:id/transfer", isOwner, wrap(async (req, res) => {
  const id = req.params.id as string;
  const input = TransferOwnerInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }

  const newOwnerRole = await getMemberRole(id, input.data.newOwnerId);
  if (!newOwnerRole) {
    res.status(422).json({ error: "Bu kullanıcı proje üyesi değil" }); return;
  }

  await transferOwnership(id, req.userId!, input.data.newOwnerId);
  res.json({ ok: true });
}));

// ─────────────────────────────────────────────────────────────────
// Workflow Statuses
// ─────────────────────────────────────────────────────────────────
router.get("/:id/statuses", isMember, wrap(async (req, res) => {
  const statuses = await getWorkflowStatuses(req.params.id as string);
  res.json(statuses);
}));

// ─────────────────────────────────────────────────────────────────
// Board
// ─────────────────────────────────────────────────────────────────
router.get("/:id/board", isMember, wrap(async (req, res) => {
  const sprintId = typeof req.query.sprintId === "string" ? req.query.sprintId : null;
  const data = await getBoardData(req.params.id as string, sprintId);
  if (!data) { res.status(404).json({ error: "Proje bulunamadı" }); return; }
  res.json(data);
}));

// ─────────────────────────────────────────────────────────────────
// Issues
// ─────────────────────────────────────────────────────────────────
router.get("/:id/labels", isMember, wrap(async (req, res) => {
  const labels = await getProjectLabels(req.params.id as string);
  res.json(labels);
}));

router.get("/:id/issues", isMember, wrap(async (req, res) => {
  const id = req.params.id as string;
  const q = req.query;
  const { issues, total } = await getIssues(id, {
    status:   typeof q.status   === "string" ? q.status   : undefined,
    assignee: typeof q.assignee === "string" ? q.assignee : undefined,
    type:     typeof q.type     === "string" ? q.type     : undefined,
    priority: typeof q.priority === "string" ? q.priority : undefined,
    label:    typeof q.label    === "string" ? q.label    : undefined,
    sprint:   typeof q.sprint   === "string" ? q.sprint   : undefined,
    q:        typeof q.q        === "string" ? q.q        : undefined,
    page:     typeof q.page     === "string" ? Number(q.page) : 1,
    limit:    typeof q.limit    === "string" ? Number(q.limit) : 50,
    archived: false,
  });
  res.json({ issues, total });
}));

router.get("/:id/issues/archived", isMember, wrap(async (req, res) => {
  const id = req.params.id as string;
  const { issues, total } = await getIssues(id, {
    archived: true,
    page:  typeof req.query.page  === "string" ? Number(req.query.page)  : 1,
    limit: typeof req.query.limit === "string" ? Number(req.query.limit) : 50,
  });
  res.json({ issues, total });
}));

router.get("/:id/issues/:issueId", isMember, wrap(async (req, res) => {
  const id = req.params.id as string;
  const issueId = req.params.issueId as string;
  const detail = await getIssueDetail(issueId);
  if (!detail || detail.projectId !== id) {
    res.status(404).json({ error: "Issue bulunamadı" }); return;
  }
  res.json(detail);
}));

router.post("/:id/issues", canReport, wrap(async (req, res) => {
  const id = req.params.id as string;
  const input = CreateIssueInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }

  if (req.projectRole === "reporter" && !["task", "bug"].includes(input.data.issueType)) {
    res.status(403).json({ error: "Reporter sadece task ve bug oluşturabilir" }); return;
  }

  const defaultStatus = await getDefaultStatus(id);
  if (!defaultStatus) { res.status(500).json({ error: "Proje workflow durumu bulunamadı" }); return; }

  const { rows: projRows } = await pool.query(
    "SELECT project_key, name FROM projects WHERE id = $1", [id]
  );
  if (!projRows[0]) { res.status(404).json({ error: "Proje bulunamadı" }); return; }

  const issue = await createIssue({
    projectId: id,
    projectKey: projRows[0].project_key as string,
    reporterId: req.userId!,
    title: input.data.title,
    description: input.data.description,
    issueType: input.data.issueType,
    priority: input.data.priority,
    labels: input.data.labels,
    assigneeId: input.data.assigneeId,
    dueDate: input.data.dueDate,
    estimatedHours: input.data.estimatedHours,
    sprintId: input.data.sprintId,
    statusId: defaultStatus.id,
  });

  if (issue.assigneeId) {
    const { rows: userRows } = await pool.query(
      "SELECT username FROM users WHERE id = $1", [req.userId]
    );
    await enqueueProjectNotification({
      type: "issue_assigned",
      issueId: issue.id,
      assigneeId: issue.assigneeId,
      assignerName: userRows[0]?.username ?? "Bilinmiyor",
      projectName: projRows[0].name as string,
      issueKey: issue.issueKey,
      issueTitle: issue.title,
    });
  }

  await invalidateBoardCache(id);
  await publishProjectEvent(id, { type: "issue_created", issueId: issue.id, issue });

  res.status(201).json(issue);
}));

router.patch("/:id/issues/:issueId", canReport, wrap(async (req, res) => {
  const id = req.params.id as string;
  const issueId = req.params.issueId as string;
  const current = await getIssueById(issueId);
  if (!current || current.projectId !== id) {
    res.status(404).json({ error: "Issue bulunamadı" }); return;
  }

  const myLevel = ROLE_HIERARCHY[req.projectRole!];
  if (myLevel < ROLE_HIERARCHY.developer && current.reporterId !== req.userId) {
    res.status(403).json({ error: "Bu issue'yu düzenleme yetkiniz yok" }); return;
  }

  const input = UpdateIssueInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }

  const updated = await updateIssue(issueId, input.data, req.userId!);
  if (!updated) { res.status(404).json({ error: "Issue bulunamadı" }); return; }

  if ("assigneeId" in input.data && input.data.assigneeId && input.data.assigneeId !== current.assigneeId) {
    const { rows: userRows } = await pool.query(
      "SELECT username FROM users WHERE id = $1", [req.userId]
    );
    const { rows: projRows } = await pool.query(
      "SELECT name FROM projects WHERE id = $1", [id]
    );
    await enqueueProjectNotification({
      type: "issue_assigned",
      issueId: updated.id,
      assigneeId: input.data.assigneeId,
      assignerName: userRows[0]?.username ?? "Bilinmiyor",
      projectName: projRows[0]?.name ?? "",
      issueKey: updated.issueKey,
      issueTitle: updated.title,
    });
  }

  if ("statusId" in input.data && updated.statusCategory === "done" && updated.assigneeId) {
    const { rows: projRows } = await pool.query(
      "SELECT name FROM projects WHERE id = $1", [id]
    );
    const { rows: userRows } = await pool.query(
      "SELECT username FROM users WHERE id = $1", [req.userId]
    );
    await enqueueProjectNotification({
      type: "issue_done",
      issueId: updated.id,
      assigneeId: updated.assigneeId,
      toStatus: updated.statusName ?? "",
      changerName: userRows[0]?.username ?? "Bilinmiyor",
      issueKey: updated.issueKey,
      issueTitle: updated.title,
    });
  }

  await invalidateIssueCache(issueId);
  await invalidateBoardCache(id);
  await publishProjectEvent(id, { type: "issue_updated", issueId: updated.id, issue: updated });

  res.json(updated);
}));

router.delete("/:id/issues/:issueId", canReport, wrap(async (req, res) => {
  const id = req.params.id as string;
  const issueId = req.params.issueId as string;
  const current = await getIssueById(issueId);
  if (!current || current.projectId !== id) {
    res.status(404).json({ error: "Issue bulunamadı" }); return;
  }

  const myLevel = ROLE_HIERARCHY[req.projectRole!];
  if (myLevel < ROLE_HIERARCHY.developer && current.reporterId !== req.userId) {
    res.status(403).json({ error: "Bu issue'yu silme yetkiniz yok" }); return;
  }

  await archiveIssue(issueId, true);
  await invalidateIssueCache(issueId);
  await invalidateBoardCache(id);
  await publishProjectEvent(id, { type: "issue_deleted", issueId: current.id });

  res.json({ ok: true });
}));

router.patch("/:id/issues/:issueId/restore", isAdmin, wrap(async (req, res) => {
  const id = req.params.id as string;
  const issueId = req.params.issueId as string;
  const current = await getIssueById(issueId);
  if (!current || current.projectId !== id) {
    res.status(404).json({ error: "Issue bulunamadı" }); return;
  }

  await archiveIssue(issueId, false);
  await invalidateIssueCache(issueId);
  await invalidateBoardCache(id);
  res.json({ ok: true });
}));

router.patch("/:id/issues/:issueId/status", isDev, wrap(async (req, res) => {
  const id = req.params.id as string;
  const issueId = req.params.issueId as string;
  const { statusId } = req.body as { statusId?: string };
  if (!statusId) { res.status(400).json({ error: "statusId gerekli" }); return; }

  const current = await getIssueById(issueId);
  if (!current || current.projectId !== id) {
    res.status(404).json({ error: "Issue bulunamadı" }); return;
  }

  const statuses = await getWorkflowStatuses(id);
  if (!statuses.find(s => s.id === statusId)) {
    res.status(422).json({ error: "Geçersiz status" }); return;
  }

  const updated = await updateIssue(issueId, { statusId }, req.userId!);
  await invalidateIssueCache(issueId);
  await invalidateBoardCache(id);
  await publishProjectEvent(id, {
    type: "issue_status_changed", issueId,
    oldStatusId: current.statusId, newStatusId: statusId,
  });

  res.json(updated);
}));

// ─────────────────────────────────────────────────────────────────
// Comments
// ─────────────────────────────────────────────────────────────────
router.get("/:id/issues/:issueId/comments", isMember, wrap(async (req, res) => {
  const comments = await getIssueComments(req.params.issueId as string);
  res.json(comments);
}));

router.post("/:id/issues/:issueId/comments", canReport, wrap(async (req, res) => {
  const id = req.params.id as string;
  const issueId = req.params.issueId as string;
  const input = CreateCommentInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }

  const current = await getIssueById(issueId);
  if (!current || current.projectId !== id) {
    res.status(404).json({ error: "Issue bulunamadı" }); return;
  }

  const mentionUsernames = [...input.data.content.matchAll(/@(\w+)/g)].map(m => m[1]);
  let mentionIds: string[] = [];
  if (mentionUsernames.length > 0) {
    const placeholders = mentionUsernames.map((_, i) => `$${i + 1}`).join(",");
    const { rows: userRows } = await pool.query(
      `SELECT id FROM users WHERE username IN (${placeholders})`,
      mentionUsernames
    );
    mentionIds = userRows.map((r: any) => r.id as string);
  }

  const comment = await addComment(issueId, req.userId!, input.data.content, mentionIds);

  const { rows: projRows } = await pool.query("SELECT name FROM projects WHERE id = $1", [id]);
  const { rows: authorRows } = await pool.query("SELECT username FROM users WHERE id = $1", [req.userId]);

  for (const mentionedId of mentionIds) {
    if (mentionedId === req.userId) continue;
    await enqueueProjectNotification({
      type: "comment_mention",
      issueId,
      mentionedId,
      authorName: authorRows[0]?.username ?? "Birisi",
      projectName: projRows[0]?.name ?? "",
      issueKey: current.issueKey,
      commentPreview: input.data.content.slice(0, 100),
    });
  }

  await publishProjectEvent(id, { type: "comment_added", issueId, comment });
  res.status(201).json(comment);
}));

router.put("/:id/issues/:issueId/comments/:commentId", isMember, wrap(async (req, res) => {
  const id = req.params.id as string;
  const issueId = req.params.issueId as string;
  const commentId = req.params.commentId as string;
  const input = CreateCommentInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }

  const updated = await updateComment(commentId, req.userId!, input.data.content);
  if (!updated) { res.status(403).json({ error: "Yorum bulunamadı veya yetkiniz yok" }); return; }
  await publishProjectEvent(id, { type: "comment_edited", issueId, commentId });
  res.json(updated);
}));

router.delete("/:id/issues/:issueId/comments/:commentId", isMember, wrap(async (req, res) => {
  const id = req.params.id as string;
  const issueId = req.params.issueId as string;
  const commentId = req.params.commentId as string;
  const comment = await getComment(commentId);
  if (!comment) { res.status(404).json({ error: "Yorum bulunamadı" }); return; }

  const myLevel = ROLE_HIERARCHY[req.projectRole!];
  if (comment.authorId !== req.userId && myLevel < ROLE_HIERARCHY.admin) {
    res.status(403).json({ error: "Bu yorumu silme yetkiniz yok" }); return;
  }

  await deleteComment(commentId);
  await publishProjectEvent(id, { type: "comment_deleted", issueId, commentId });
  res.json({ ok: true });
}));

// ─────────────────────────────────────────────────────────────────
// "Planimma Ekle" bridge
// ─────────────────────────────────────────────────────────────────
router.post("/:id/issues/:issueId/add-to-plan", isMember, wrap(async (req, res) => {
  const id = req.params.id as string;
  const issueId = req.params.issueId as string;
  const input = AddToPlanInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: zodMsg(input.error) }); return; }

  const issue = await getIssueById(issueId);
  if (!issue || issue.projectId !== id) {
    res.status(404).json({ error: "Issue bulunamadı" }); return;
  }
  if (issue.assigneeId !== req.userId) {
    res.status(403).json({ error: "Sadece atanan kisi planina ekleyebilir" }); return;
  }
  if (issue.planItemId) {
    res.status(409).json({ error: "Bu issue zaten planiniza eklenmis" }); return;
  }

  const { planItemId } = await addIssueToPlan(
    issueId, req.userId!, input.data.date, input.data.scheduledTime
  );
  await invalidateBoardCache(id);
  await publishProjectEvent(id, { type: "issue_updated", issueId: issue.id });

  res.json({ planItemId, ok: true });
}));

router.delete("/:id/issues/:issueId/add-to-plan", isMember, wrap(async (req, res) => {
  const id = req.params.id as string;
  const issueId = req.params.issueId as string;
  const issue = await getIssueById(issueId);
  if (!issue || issue.projectId !== id) {
    res.status(404).json({ error: "Issue bulunamadı" }); return;
  }
  if (issue.assigneeId !== req.userId) {
    res.status(403).json({ error: "Sadece atanan kisi plandan cikarabilir" }); return;
  }

  await removeIssueFromPlan(issueId);
  await invalidateBoardCache(id);
  res.json({ ok: true });
}));

// ─────────────────────────────────────────────────────────────────
// Issue Links
// ─────────────────────────────────────────────────────────────────
router.get("/:id/issues/:issueId/links", isMember, wrap(async (req, res) => {
  const links = await getIssueLinks(req.params.issueId as string);
  res.json(links);
}));

router.post("/:id/issues/:issueId/links", canReport, wrap(async (req, res) => {
  const { targetId, linkType } = req.body as { targetId: string; linkType: string };
  const validTypes = ["relates_to", "blocks", "is_blocked_by", "duplicates", "is_duplicated_by"];
  if (!targetId || !validTypes.includes(linkType)) {
    res.status(400).json({ error: "Geçersiz parametre" }); return;
  }

  // Accept both UUID and issue key (e.g. "GMD-1")
  let resolvedTargetId = targetId;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(targetId)) {
    const { rows } = await pool.query(
      "SELECT id FROM issues WHERE issue_key = $1 AND project_id = $2",
      [targetId.toUpperCase(), req.params.id]
    );
    if (!rows[0]) { res.status(404).json({ error: "Issue bulunamadı" }); return; }
    resolvedTargetId = rows[0].id;
  }

  const result = await createIssueLink(
    req.params.id as string,
    req.params.issueId as string,
    resolvedTargetId,
    linkType,
    req.userId!
  );
  if (!result.ok) { res.status(422).json({ error: result.error }); return; }
  await invalidateIssueCache(req.params.issueId as string);
  res.status(201).json(result.link);
}));

router.delete("/:id/issues/:issueId/links/:linkId", canReport, wrap(async (req, res) => {
  await deleteIssueLink(req.params.linkId as string, req.params.id as string, req.params.issueId as string);
  await invalidateIssueCache(req.params.issueId as string);
  res.json({ ok: true });
}));

// ─────────────────────────────────────────────────────────────────
// Workflow Statuses — CRUD (admin+)
// ─────────────────────────────────────────────────────────────────
router.post("/:id/statuses", isAdmin, wrap(async (req, res) => {
  const { name, color, category } = req.body as { name: string; color: string; category: string };
  if (!name?.trim() || !color || !["todo", "in_progress", "done"].includes(category)) {
    res.status(400).json({ error: "Geçersiz parametre" }); return;
  }
  const status = await createWorkflowStatus(
    req.params.id as string,
    { name: name.trim(), color, category: category as "todo" | "in_progress" | "done" }
  );
  res.status(201).json(status);
}));

router.patch("/:id/statuses/:sid", isAdmin, wrap(async (req, res) => {
  const { name, color, category, isDefault } = req.body as Record<string, unknown>;
  const status = await updateWorkflowStatus(
    req.params.sid as string,
    req.params.id as string,
    {
      name:      typeof name === "string" ? name.trim() : undefined,
      color:     typeof color === "string" ? color : undefined,
      category:  typeof category === "string" ? category : undefined,
      isDefault: typeof isDefault === "boolean" ? isDefault : undefined,
    }
  );
  if (!status) { res.status(404).json({ error: "Durum bulunamadı" }); return; }
  res.json(status);
}));

router.delete("/:id/statuses/:sid", isAdmin, wrap(async (req, res) => {
  const result = await deleteWorkflowStatus(req.params.sid as string, req.params.id as string);
  if (!result.ok) { res.status(422).json({ error: result.error }); return; }
  res.json({ ok: true });
}));

// ─────────────────────────────────────────────────────────────────
// SSE
// ─────────────────────────────────────────────────────────────────
router.get("/:id/events", isMember, (req, res) => {
  const id = req.params.id as string;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  const unsub = subscribeProjectEvents(id, (msg) => {
    res.write(`data: ${msg}\n\n`);
  });
  const hb = setInterval(() => res.write(": heartbeat\n\n"), 30_000);
  req.on("close", () => { clearInterval(hb); unsub(); });
});

export default router;
