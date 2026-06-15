# 07 — RBAC (Rol Tabanlı Erişim Kontrolü)

## Rol Hiyerarşisi

```
owner > admin > developer > reporter > viewer
  5         4         3          2        1
```

| Rol | Kim? |
|-----|------|
| **owner** | Projeyi oluşturan kişi. Silinemez, devredilebilir. |
| **admin** | Proje yöneticisi. Üye ekler/çıkarır, sprint yönetir, workflow düzenler. |
| **developer** | Standart geliştirici. Issue açar, günceller, tamamlar. |
| **reporter** | Sadece bug/request açabilir. Kendi açtıklarını düzenleyebilir. |
| **viewer** | Sadece okuyabilir. Yorum yapamaz. |

---

## Yetki Matrisi (Phase 1–2)

| İşlem | viewer | reporter | developer | admin | owner |
|-------|--------|----------|-----------|-------|-------|
| Projeyi görüntüle | ✅ | ✅ | ✅ | ✅ | ✅ |
| Proje ayarlarını güncelle | ❌ | ❌ | ❌ | ✅ | ✅ |
| Projeyi sil | ❌ | ❌ | ❌ | ❌ | ✅ |
| Üye davet et | ❌ | ❌ | ❌ | ✅ | ✅ |
| Üye çıkar (member/reporter/dev) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Üye çıkar (admin) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Rol güncelle | ❌ | ❌ | ❌ | ❌ | ✅ |
| Issue görüntüle | ✅ | ✅ | ✅ | ✅ | ✅ |
| Task oluştur | ❌ | ✅ | ✅ | ✅ | ✅ |
| Bug oluştur | ❌ | ✅ | ✅ | ✅ | ✅ |
| Story/Epic oluştur | ❌ | ❌ | ✅ | ✅ | ✅ |
| Issue güncelle (herhangi) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Issue güncelle (kendi açtığı) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Issue sil (kendi açtığı) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Issue sil (herhangi) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Issue atama değiştir | ❌ | ❌ | ✅ | ✅ | ✅ |
| Yorum yaz | ❌ | ✅ | ✅ | ✅ | ✅ |
| Kendi yorumunu sil/düzenle | ❌ | ✅ | ✅ | ✅ | ✅ |
| Başkasının yorumunu sil | ❌ | ❌ | ❌ | ✅ | ✅ |
| Workflow durum ekle/güncelle | ❌ | ❌ | ❌ | ✅ | ✅ |
| Sprint oluştur/güncelle | ❌ | ❌ | ❌ | ✅ | ✅ |
| Sprint başlat/bitir | ❌ | ❌ | ❌ | ✅ | ✅ |
| Backlog yönet | ❌ | ❌ | ✅ | ✅ | ✅ |
| Webhook ekle/güncelle (Phase 4) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Custom field tanımla (Phase 3) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Sahipliği devret | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Middleware Implementasyonu

```typescript
// routes/projects.ts

type ProjectRole = "owner" | "admin" | "developer" | "reporter" | "viewer";

const ROLE_HIERARCHY: Record<ProjectRole, number> = {
  viewer:    1,
  reporter:  2,
  developer: 3,
  admin:     4,
  owner:     5,
};

function requireProjectMembership(minRole: ProjectRole = "viewer") {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const projectId = req.params.id ?? req.params.projectId;
    if (!projectId) return res.status(400).json({ error: "Proje ID gerekli" });

    const role = await getMemberRole(projectId, req.userId!);  // Redis cached
    if (!role) return res.status(403).json({ error: "Bu projeye erişim yetkiniz yok" });

    if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minRole]) {
      return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
    }

    req.projectRole = role;   // sonraki handler'da kullanılabilir
    req.projectId   = projectId;
    next();
  };
}

// Kısayollar
const isMember = requireProjectMembership("viewer");
const canReport = requireProjectMembership("reporter");
const isDev     = requireProjectMembership("developer");
const isAdmin   = requireProjectMembership("admin");
const isOwner   = requireProjectMembership("owner");
```

### Bağlamsal Kontrol (Middleware Sonrası)

Bazı kontroller middleware'de değil route handler'da yapılır:

```typescript
// "Kendi issue'sunu güncelleyebilir" kontrolü:
router.patch("/:id/issues/:issueId", canReport, wrap(async (req, res) => {
  const issue = await getIssue(req.params.issueId);
  if (!issue) return res.status(404).json({ error: "Issue bulunamadı" });

  const canEdit = req.projectRole === "developer" || req.projectRole === "admin"
               || req.projectRole === "owner"
               || (req.projectRole === "reporter" && issue.reporterId === req.userId);

  if (!canEdit) return res.status(403).json({ error: "Bu issue'yu düzenleme yetkiniz yok" });
  // ...
}));
```

---

## Sahiplik Devri

```typescript
router.post("/:id/transfer", isOwner, wrap(async (req, res) => {
  const { newOwnerId } = TransferOwnerInput.parse(req.body);

  // newOwnerId proje üyesi mi?
  const newOwnerRole = await getMemberRole(req.params.id, newOwnerId);
  if (!newOwnerRole) return res.status(422).json({ error: "Bu kullanıcı proje üyesi değil" });

  await pool.query("BEGIN");
  try {
    await pool.query(
      "UPDATE project_members SET role='owner' WHERE project_id=$1 AND user_id=$2",
      [req.params.id, newOwnerId]
    );
    await pool.query(
      "UPDATE project_members SET role='admin' WHERE project_id=$1 AND user_id=$2",
      [req.params.id, req.userId]
    );
    await pool.query("COMMIT");
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }

  await invalidateAllMemberCaches(req.params.id);
  res.json({ ok: true });
}));
```

---

## Edge Case'ler

| Durum | Çözüm |
|-------|-------|
| Owner gruptan ayrılmak ister | 400: "Sahipliği devretmeden ayrılamazsınız" |
| Admin, owner'ı çıkarmaya çalışır | 403: "Owner rolüne sahip üyeyi çıkaramazsınız" |
| Reporter, başkasının bug'ını günceller | 403 |
| Viewer yorum yazmaya çalışır | 403 |
| Davet edilen kişinin rolü | `project_invitations.invited_role` — kabul anında bu rol atanır |
| Rol düşürme (admin → developer) | Mümkün, owner yapar |

---

## Phase 4: Granüler Yetki Matrisi

*Post-MVP. Referans için tasarım:*

```sql
-- Özel roller ve granüler izinler (Phase 4)
CREATE TABLE project_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role          TEXT NOT NULL,     -- built-in veya özel rol adı
  permission    TEXT NOT NULL,     -- "issue.create", "sprint.start", "comment.delete_any"
  granted       BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (project_id, role, permission)  -- aslında UUID PK yeterli
);
```

**Olası izin token'ları (Phase 4):**
```
issue.view              issue.create            issue.update_any
issue.update_own        issue.delete_any        issue.delete_own
issue.assign            issue.transition        sprint.manage
sprint.start            sprint.complete         workflow.manage
member.invite           member.remove           member.role_change
comment.create          comment.delete_any      comment.delete_own
webhook.manage          custom_field.manage     attachment.upload
```
