import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/lib/api";
import type {
  CreateProjectInput, UpdateProjectInput,
  CreateIssueInput, UpdateIssueInput,
  CreateCommentInput, InviteMemberInput, UpdateMemberRoleInput, TransferOwnerInput,
  AddToPlanInput, BoardData, Issue, IssueLinkType,
  CreateSprintInput, UpdateSprintInput, CompleteSprintInput,
} from "@gmd/shared";

// ── Project list ─────────────────────────────────────────────────
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects(),
    staleTime: 30_000,
  });
}

// ── Single project (with members + statuses) ─────────────────────
export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => api.getProject(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ── Board data ────────────────────────────────────────────────────
export function useBoard(projectId: string | undefined, sprintId?: string | null) {
  return useQuery({
    queryKey: ["board", projectId, sprintId ?? null],
    queryFn: () => api.getBoard(projectId!, sprintId),
    enabled: !!projectId,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

// ── Project labels (for autocomplete) ────────────────────────────
export function useProjectLabels(projectId: string | undefined) {
  return useQuery({
    queryKey: ["labels", projectId],
    queryFn: () => api.getProjectLabels(projectId!),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

// ── Issue list (filtered) ─────────────────────────────────────────
export function useIssues(projectId: string | undefined, filters?: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ["issues", projectId, filters],
    queryFn: () => api.getIssues(projectId!, filters),
    enabled: !!projectId,
    staleTime: 20_000,
  });
}

// ── Single issue (detail with comments + history) ─────────────────
export function useIssue(projectId: string | undefined, issueId: string | undefined) {
  return useQuery({
    queryKey: ["issue", issueId],
    queryFn: () => api.getIssue(projectId!, issueId!),
    enabled: !!projectId && !!issueId,
    staleTime: 30_000,
  });
}

// ── Archived issues ───────────────────────────────────────────────
export function useArchivedIssues(projectId: string | undefined, enabled = false) {
  return useQuery({
    queryKey: ["issues-archived", projectId],
    queryFn: () => api.getArchivedIssues(projectId!),
    enabled: !!projectId && enabled,
    staleTime: 30_000,
  });
}

// ── My assignments for DayView banner ────────────────────────────
export function useMyAssignments(date?: string) {
  return useQuery({
    queryKey: ["my-assignments", date],
    queryFn: () => api.getMyAssignments(date),
    staleTime: 60_000,
  });
}

// ── Project mutations (create, update, delete, members) ──────────
export function useProjectMutations() {
  const qc = useQueryClient();

  const createProject = useMutation({
    mutationFn: (data: CreateProjectInput) => api.createProject(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  const updateProject = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectInput }) =>
      api.updateProject(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
  });

  const deleteProject = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  const inviteMember = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InviteMemberInput }) =>
      api.inviteMember(id, data),
  });

  const leaveProject = useMutation({
    mutationFn: (id: string) => api.leaveProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  const removeMember = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      api.removeMember(id, userId),
    onSuccess: (_res, { id }) => qc.invalidateQueries({ queryKey: ["project", id] }),
  });

  const updateMemberRole = useMutation({
    mutationFn: ({ id, userId, data }: { id: string; userId: string; data: UpdateMemberRoleInput }) =>
      api.updateMemberRole(id, userId, data),
    onSuccess: (_res, { id }) => qc.invalidateQueries({ queryKey: ["project", id] }),
  });

  const transferOwnership = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransferOwnerInput }) =>
      api.transferOwnership(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
  });

  return { createProject, updateProject, deleteProject, inviteMember, leaveProject, removeMember, updateMemberRole, transferOwnership };
}

// ── Issue mutations ───────────────────────────────────────────────
export function useIssueMutations(projectId: string) {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["board", projectId] });
    qc.invalidateQueries({ queryKey: ["issues", projectId] });
  };

  const createIssue = useMutation({
    mutationFn: (data: CreateIssueInput) => api.createIssue(projectId, data),
    onSuccess: (_res, vars) => {
      invalidate();
      // If sub-task, refresh parent issue so children list updates
      if ((vars as any).parentId) {
        qc.invalidateQueries({ queryKey: ["issue", (vars as any).parentId] });
      }
    },
  });

  const updateIssue = useMutation({
    mutationFn: ({ issueId, data }: { issueId: string; data: UpdateIssueInput }) =>
      api.updateIssue(projectId, issueId, data),
    onSuccess: (_res, { issueId }) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["issue", issueId] });
    },
  });

  // ── helpers: patch every board cache entry for this project ──────
  type BoardSnapshot = [readonly unknown[], BoardData];
  const patchAllBoards = (patcher: (b: BoardData) => BoardData): BoardSnapshot[] => {
    const entries = qc.getQueriesData<BoardData>({ queryKey: ["board", projectId] });
    const snapshots: BoardSnapshot[] = [];
    for (const [key, prev] of entries) {
      if (!prev) continue;
      snapshots.push([key, prev]);
      qc.setQueryData(key, patcher(prev));
    }
    return snapshots;
  };
  const restoreSnapshots = (snapshots: BoardSnapshot[]) => {
    for (const [key, data] of snapshots) qc.setQueryData(key, data);
  };

  const updateIssueStatus = useMutation({
    mutationFn: ({ issueId, statusId }: { issueId: string; statusId: string }) =>
      api.updateIssueStatus(projectId, issueId, statusId),
    onMutate: async ({ issueId, statusId }) => {
      await qc.cancelQueries({ queryKey: ["board", projectId] });
      const snapshots = patchAllBoards(prev => {
        const cols = { ...prev.columns };
        let movedIssue: Issue | undefined;
        for (const colId of Object.keys(cols)) {
          const idx = cols[colId].issues.findIndex(i => i.id === issueId);
          if (idx !== -1) {
            movedIssue = { ...cols[colId].issues[idx], statusId };
            cols[colId] = { ...cols[colId], issues: cols[colId].issues.filter(i => i.id !== issueId) };
            break;
          }
        }
        if (movedIssue && cols[statusId]) {
          cols[statusId] = { ...cols[statusId], issues: [...cols[statusId].issues, movedIssue] };
        }
        return { ...prev, columns: cols };
      });
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => ctx?.snapshots && restoreSnapshots(ctx.snapshots),
    onSettled: () => invalidate(),
  });

  const deleteIssue = useMutation({
    mutationFn: (issueId: string) => api.deleteIssue(projectId, issueId),
    onSuccess: invalidate,
  });

  const restoreIssue = useMutation({
    mutationFn: (issueId: string) => api.restoreIssue(projectId, issueId),
    onSuccess: (_res, issueId) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["issues-archived", projectId] });
      qc.invalidateQueries({ queryKey: ["issue", issueId] });
    },
  });

  const permanentDeleteIssue = useMutation({
    mutationFn: (issueId: string) => api.permanentDeleteIssue(projectId, issueId),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["issues-archived", projectId] });
    },
  });

  const addIssueToPlan = useMutation({
    mutationFn: ({ issueId, data }: { issueId: string; data: AddToPlanInput }) =>
      api.addIssueToPlan(projectId, issueId, data),
    onSuccess: (_res, { issueId, data }) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["issue", issueId] });
      qc.invalidateQueries({ queryKey: ["my-assignments"] });
      qc.invalidateQueries({ queryKey: ["daylog", data.date] });
    },
  });

  const removeIssueFromPlan = useMutation({
    mutationFn: (issueId: string) => api.removeIssueFromPlan(projectId, issueId),
    onSuccess: (_res, issueId) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["issue", issueId] });
      qc.invalidateQueries({ queryKey: ["daylog"] });
    },
  });

  const reorderIssues = useMutation({
    mutationFn: (orders: Array<{ issueId: string; sortOrder: number }>) =>
      api.reorderIssues(projectId, orders),
    onMutate: async (orders) => {
      await qc.cancelQueries({ queryKey: ["board", projectId] });
      const issueIdSet = new Set(orders.map(o => o.issueId));
      const orderMap = new Map(orders.map(o => [o.issueId, o.sortOrder]));
      const snapshots = patchAllBoards(prev => {
        const cols = { ...prev.columns };
        for (const colId of Object.keys(cols)) {
          if (!cols[colId].issues.some(i => issueIdSet.has(i.id))) continue;
          const sorted = [...cols[colId].issues].sort((a, b) =>
            (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity)
          );
          cols[colId] = { ...cols[colId], issues: sorted };
          break;
        }
        return { ...prev, columns: cols };
      });
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => ctx?.snapshots && restoreSnapshots(ctx.snapshots),
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", projectId] }),
  });

  return { createIssue, updateIssue, updateIssueStatus, deleteIssue, restoreIssue, permanentDeleteIssue, addIssueToPlan, removeIssueFromPlan, reorderIssues };
}

// ── Comment mutations ─────────────────────────────────────────────
export function useCommentMutations(projectId: string, issueId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["issue", issueId] });

  const addComment = useMutation({
    mutationFn: (data: CreateCommentInput) => api.addComment(projectId, issueId, data),
    onSuccess: invalidate,
  });

  const updateComment = useMutation({
    mutationFn: ({ commentId, data }: { commentId: string; data: CreateCommentInput }) =>
      api.updateComment(projectId, issueId, commentId, data),
    onSuccess: invalidate,
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: string) => api.deleteComment(projectId, issueId, commentId),
    onSuccess: invalidate,
  });

  return { addComment, updateComment, deleteComment };
}

// ── Issue link mutations ──────────────────────────────────────────
export function useIssueLinkMutations(projectId: string, issueId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["issue", issueId] });

  const createLink = useMutation({
    mutationFn: (data: { targetId: string; linkType: IssueLinkType }) =>
      api.createIssueLink(projectId, issueId, data),
    onSuccess: invalidate,
  });

  const deleteLink = useMutation({
    mutationFn: (linkId: string) => api.deleteIssueLink(projectId, issueId, linkId),
    onSuccess: invalidate,
  });

  return { createLink, deleteLink };
}

// ── Workflow status mutations ─────────────────────────────────────
export function useStatusMutations(projectId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["project", projectId] });

  const createStatus = useMutation({
    mutationFn: (data: { name: string; color: string; category: string }) =>
      api.createStatus(projectId, data),
    onSuccess: invalidate,
  });

  const updateStatus = useMutation({
    mutationFn: ({ sid, data }: { sid: string; data: { name?: string; color?: string; category?: string; isDefault?: boolean } }) =>
      api.updateStatus(projectId, sid, data),
    onSuccess: invalidate,
  });

  const deleteStatus = useMutation({
    mutationFn: (sid: string) => api.deleteStatus(projectId, sid),
    onSuccess: invalidate,
  });

  const reorderStatuses = useMutation({
    mutationFn: (orders: Array<{ statusId: string; sortOrder: number }>) =>
      api.reorderStatuses(projectId, orders),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["board", projectId] });
    },
  });

  return { createStatus, updateStatus, deleteStatus, reorderStatuses };
}

// ── Sprints ───────────────────────────────────────────────────────
export function useSprints(projectId: string | undefined) {
  return useQuery({
    queryKey: ["sprints", projectId],
    queryFn: () => api.getSprints(projectId!),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useSprintMutations(projectId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sprints", projectId] });
    qc.invalidateQueries({ queryKey: ["board", projectId] });
  };

  const createSprint = useMutation({
    mutationFn: (data: CreateSprintInput) => api.createSprint(projectId, data),
    onSuccess: invalidate,
  });

  const updateSprint = useMutation({
    mutationFn: ({ sprintId, data }: { sprintId: string; data: UpdateSprintInput }) =>
      api.updateSprint(projectId, sprintId, data),
    onSuccess: invalidate,
  });

  const deleteSprint = useMutation({
    mutationFn: (sprintId: string) => api.deleteSprint(projectId, sprintId),
    onSuccess: invalidate,
  });

  const setIssueSprint = useMutation({
    mutationFn: ({ issueId, sprintId }: { issueId: string; sprintId: string | null }) =>
      api.setIssueSprint(projectId, issueId, sprintId),
    onSuccess: (_res, { issueId }) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["issues", projectId] });
      qc.invalidateQueries({ queryKey: ["issue", issueId] });
    },
  });

  const completeSprint = useMutation({
    mutationFn: ({ sprintId, data }: { sprintId: string; data: CompleteSprintInput }) =>
      api.completeSprint(projectId, sprintId, data),
    onSuccess: () => invalidate(),
  });

  return { createSprint, updateSprint, deleteSprint, setIssueSprint, completeSprint };
}

// ── SSE hook — invalidates queries on server events ───────────────
export function useProjectEvents(projectId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!projectId) return;
    const es = new EventSource(`/api/projects/${projectId}/events`, { withCredentials: true });
    es.onmessage = (e) => {
      const ev = JSON.parse(e.data);
      if (ev.type === "connected") return;

      if (["issue_created", "issue_updated", "issue_deleted", "issue_status_changed"].includes(ev.type)) {
        qc.invalidateQueries({ queryKey: ["board", projectId] });
        qc.invalidateQueries({ queryKey: ["issues", projectId] });
        if (ev.issueId) qc.invalidateQueries({ queryKey: ["issue", ev.issueId] });
      }
      if (["comment_added", "comment_edited", "comment_deleted"].includes(ev.type)) {
        if (ev.issueId) qc.invalidateQueries({ queryKey: ["issue", ev.issueId] });
        if (ev.type === "comment_added") qc.invalidateQueries({ queryKey: ["notifications"] });
      }
      if (["member_joined", "member_left"].includes(ev.type)) {
        qc.invalidateQueries({ queryKey: ["project", projectId] });
      }
    };
    return () => es.close();
  }, [projectId, qc]);
}
