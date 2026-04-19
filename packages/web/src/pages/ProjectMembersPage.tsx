import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, ChevronDown, X, Crown, Shield, Code2, Eye, FileText, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useProject, useProjectMutations } from "@/hooks/useProjects";
import { cn } from "@/lib/cn";
import type { ProjectRole } from "@gmd/shared";

const ROLE_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  owner:     Crown,
  admin:     Shield,
  developer: Code2,
  reporter:  FileText,
  viewer:    Eye,
};

const ROLE_COLORS: Record<string, string> = {
  owner:     "text-yellow-400 bg-yellow-400/10",
  admin:     "text-purple-400 bg-purple-400/10",
  developer: "text-blue-400 bg-blue-400/10",
  reporter:  "text-green-400 bg-green-400/10",
  viewer:    "text-text-tertiary bg-bg-subtle",
};

function RoleBadge({ role }: { role: string }) {
  const { t } = useI18n();
  const Icon = ROLE_ICONS[role] ?? Eye;
  return (
    <span className={cn("flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full", ROLE_COLORS[role])}>
      <Icon size={10} />
      {t(`members.role.${role}` as any)}
    </span>
  );
}

const ASSIGNABLE_ROLES: { role: "admin" | "developer" | "reporter" | "viewer"; label: string; desc: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { role: "admin",     label: "Admin",      desc: "Her şeyi yönetir, üye ekler",       Icon: Shield  },
  { role: "developer", label: "Developer",  desc: "Issue oluşturur ve düzenler",         Icon: Code2   },
  { role: "reporter",  label: "Reporter",   desc: "Issue açar, yorum yapar",             Icon: FileText },
  { role: "viewer",    label: "İzleyici",   desc: "Sadece görüntüler",                   Icon: Eye     },
];

export default function ProjectMembersPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();

  const { data: project, isLoading } = useProject(projectId);
  const { inviteMember, removeMember, updateMemberRole, transferOwnership, leaveProject } = useProjectMutations();

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "developer" | "reporter" | "viewer">("developer");
  const [inviteStatus, setInviteStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // Role change dropdown per member
  const [openRoleMenuFor, setOpenRoleMenuFor] = useState<string | null>(null);

  // Transfer ownership modal
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");

  // Leave confirm
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (isLoading) {
    return <div className="text-sm text-text-tertiary py-12 text-center">Yükleniyor...</div>;
  }
  if (!project) {
    return <div className="text-sm text-danger py-12 text-center">Proje bulunamadı.</div>;
  }

  const myRole = project.myRole;
  const isAdmin = myRole === "admin" || myRole === "owner";
  const isOwner = myRole === "owner";
  const members = project.members ?? [];

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !projectId) return;
    setInviteStatus("sending");
    try {
      await inviteMember.mutateAsync({ id: projectId, data: { email: inviteEmail.trim(), role: inviteRole } });
      setInviteStatus("sent");
      setInviteEmail("");
    } catch {
      setInviteStatus("error");
    }
  };

  const handleRoleChange = async (userId: string, role: "admin" | "developer" | "reporter" | "viewer") => {
    setOpenRoleMenuFor(null);
    if (!projectId) return;
    await updateMemberRole.mutateAsync({ id: projectId, userId, data: { role } });
  };

  const handleRemove = async (userId: string) => {
    if (!projectId || !confirm(t("members.removeConfirm"))) return;
    await removeMember.mutateAsync({ id: projectId, userId });
  };

  const handleLeave = async () => {
    if (!projectId) return;
    await leaveProject.mutateAsync(projectId);
    navigate("/projects");
  };

  const handleTransfer = async () => {
    if (!projectId || !transferTargetId) return;
    await transferOwnership.mutateAsync({ id: projectId, data: { newOwnerId: transferTargetId } });
    setShowTransfer(false);
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          to={`/projects/${projectId}/board`}
          className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text transition-colors"
        >
          <ArrowLeft size={13} />
          {project.name}
        </Link>

        <div className="flex-1" />

        <h1 className="font-semibold text-text text-base">{t("members.title")}</h1>
        <span className="text-xs text-text-tertiary">({members.length})</span>

        {isAdmin && (
          <button
            onClick={() => { setShowInvite(true); setInviteStatus("idle"); }}
            className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs"
          >
            <UserPlus size={13} />
            {t("members.invite")}
          </button>
        )}
      </div>

      {/* Invite panel */}
      {showInvite && (
        <div className="card p-4 space-y-4 border-accent/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text">Üye Davet Et</span>
            <button onClick={() => setShowInvite(false)} className="btn-icon p-1 rounded text-text-tertiary hover:text-text">
              <X size={14} />
            </button>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">E-posta</label>
            <input
              type="email"
              className="input w-full text-sm"
              placeholder="ornek@sirket.com"
              value={inviteEmail}
              onChange={e => { setInviteEmail(e.target.value); setInviteStatus("idle"); }}
              onKeyDown={e => e.key === "Enter" && handleInvite()}
              autoFocus
            />
          </div>

          {/* Role picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">Rol</label>
            <div className="grid grid-cols-2 gap-2">
              {ASSIGNABLE_ROLES.map(({ role, label, desc, Icon }) => {
                const selected = inviteRole === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setInviteRole(role)}
                    className={cn(
                      "flex items-start gap-2 p-2.5 rounded-xl border text-left transition-colors",
                      selected
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-accent/40 hover:bg-bg-subtle"
                    )}
                  >
                    <Icon size={13} className={selected ? "text-accent mt-0.5 flex-shrink-0" : "text-text-tertiary mt-0.5 flex-shrink-0"} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-xs font-semibold leading-none", selected ? "text-accent" : "text-text")}>{label}</p>
                      <p className="text-[10px] text-text-tertiary mt-0.5 leading-snug">{desc}</p>
                    </div>
                    {selected && <Check size={11} className="text-accent flex-shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleInvite}
            disabled={inviteStatus === "sending" || !inviteEmail.trim()}
            className="btn-primary w-full py-2 text-sm disabled:opacity-50"
          >
            {inviteStatus === "sending" ? "Gönderiliyor..." : "Davet Gönder"}
          </button>

          {inviteStatus === "sent" && (
            <p className="text-xs text-green-400 text-center">Davet e-postası gönderildi.</p>
          )}
          {inviteStatus === "error" && (
            <p className="text-xs text-danger text-center">{t("members.inviteError")}</p>
          )}
        </div>
      )}

      {/* Member list */}
      <div className="card divide-y divide-border">
        {members.map(member => {
          const isMe = member.userId === user?.id;
          const canEditThisMember = isAdmin && member.role !== "owner" && !isMe;
          return (
            <div key={member.userId} className="flex items-center gap-3 p-3 hover:bg-bg-subtle/50 transition-colors">
              {/* Avatar */}
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt={member.username ?? ""} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-text-secondary">
                    {(member.username ?? "?").slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">
                  {member.displayName ?? member.username}
                  {isMe && <span className="text-[10px] text-text-tertiary ml-1">(ben)</span>}
                </p>
                {member.email && (
                  <p className="text-[10px] text-text-tertiary truncate">{member.email}</p>
                )}
              </div>

              {/* Role */}
              {canEditThisMember ? (
                <div className="relative">
                  <button
                    onClick={() => setOpenRoleMenuFor(openRoleMenuFor === member.userId ? null : member.userId)}
                    className="flex items-center gap-1"
                  >
                    <RoleBadge role={member.role} />
                    <ChevronDown size={10} className="text-text-tertiary" />
                  </button>
                  {openRoleMenuFor === member.userId && (
                    <div className="absolute right-0 top-full mt-1 bg-bg-elevated border border-border rounded-xl shadow-lg z-20 overflow-hidden min-w-[130px]">
                      {ASSIGNABLE_ROLES.map(({ role: r, label, Icon }) => (
                        <button
                          key={r}
                          onClick={() => handleRoleChange(member.userId, r)}
                          className={cn("w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent/10 transition-colors", r === member.role && "bg-accent/5 font-medium")}
                        >
                          <Icon size={11} className="text-text-tertiary flex-shrink-0" />
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <RoleBadge role={member.role} />
              )}

              {/* Actions */}
              <div className="flex items-center gap-1">
                {isOwner && !isMe && member.role !== "owner" && (
                  <button
                    onClick={() => { setTransferTargetId(member.userId); setShowTransfer(true); }}
                    className="text-[10px] text-text-tertiary hover:text-yellow-400 transition-colors px-1.5 py-1 rounded"
                    title={t("members.transferOwner")}
                  >
                    <Crown size={11} />
                  </button>
                )}
                {canEditThisMember && (
                  <button
                    onClick={() => handleRemove(member.userId)}
                    className="text-[10px] text-text-tertiary hover:text-danger transition-colors px-1.5 py-1 rounded"
                  >
                    <X size={12} />
                  </button>
                )}
                {isMe && member.role !== "owner" && (
                  <button
                    onClick={() => setConfirmLeave(true)}
                    className="text-[10px] text-text-tertiary hover:text-danger transition-colors px-1.5 py-1"
                  >
                    {t("members.leave")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leave confirm modal */}
      {confirmLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm" onClick={() => setConfirmLeave(false)}>
          <div className="card p-4 w-full max-w-xs shadow-xl space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-text text-sm">{t("members.leave")}</h3>
            <p className="text-xs text-text-secondary">{t("members.leaveConfirm")}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmLeave(false)} className="btn-secondary flex-1 py-2 text-xs">İptal</button>
              <button
                onClick={handleLeave}
                disabled={leaveProject.isPending}
                className="flex-1 py-2 text-xs bg-danger text-white rounded-lg hover:bg-danger/90 disabled:opacity-50"
              >
                {leaveProject.isPending ? "..." : t("members.leave")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer ownership modal */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm" onClick={() => setShowTransfer(false)}>
          <div className="card p-4 w-full max-w-xs shadow-xl space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-text text-sm">{t("members.transferOwner")}</h3>
            <p className="text-xs text-text-secondary">
              {t("members.transferOwner")} →{" "}
              <span className="font-medium text-text">
                {members.find(m => m.userId === transferTargetId)?.username}
              </span>
            </p>
            <p className="text-xs text-text-tertiary">Sahiplik devredildiğinde rolünüz admin olarak değişecek.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowTransfer(false)} className="btn-secondary flex-1 py-2 text-xs">İptal</button>
              <button
                onClick={handleTransfer}
                disabled={transferOwnership.isPending}
                className="flex-1 py-2 text-xs bg-danger text-white rounded-lg hover:bg-danger/90 disabled:opacity-50"
              >
                {transferOwnership.isPending ? "..." : "Devret"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
