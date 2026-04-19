# GMD Platform Mimarisi

> Tarih: 2026-04-18  
> Karar: Modüler Monolith + Ayrı Frontendler  
> Hedef kullanıcı: 100–1000 kişi

---

## Mevcut Durum

Tek Express backend, tek React frontend, tek PostgreSQL, tek Redis.  
K8s üzerinde çalışıyor (`namespace: feb`, registry: `hub.umceko.com/byfeb`).

---

## Hedef Mimari

```
            ┌─────────────────────────────────────────┐
            │           *.byfeb.com (Cloudflare)       │
            └──────┬──────────┬──────────┬────────────┘
                   │          │          │
         gmd.      │    pm.   │   diet.  │   budget.
                   ▼          ▼          ▼          ▼
            ┌──────────┐ ┌────────┐ ┌───────┐ ┌────────┐
            │ gmd-web  │ │pm-web  │ │diet-  │ │budget- │
            │ (Vite)   │ │(Vite)  │ │web    │ │web     │
            └──────────┘ └────────┘ └───────┘ └────────┘
                   │          │          │          │
                   └──────────┴──────────┴──────────┘
                                   │
                            api.byfeb.com
                         ┌─────────────────┐
                         │  Express API     │
                         │  (tek process)   │
                         │  ┌────────────┐  │
                         │  │ /modules/  │  │
                         │  │  tasks/    │  │
                         │  │  pm/       │  │
                         │  │  diet/     │  │
                         │  │  budget/   │  │
                         │  └────────────┘  │
                         └────────┬────────┘
                    ┌─────────────┴──────────────┐
               ┌────┴────┐                 ┌─────┴────┐
               │PostgreSQL│                │  Redis   │
               │(tek DB)  │                │(sessions │
               └──────────┘                │ cache)   │
                                           └──────────┘
```

---

## Veritabanı: Tek DB, Modül Prefixi

Ayrı DB yok. Tek PostgreSQL, tablo isimleri modülü belli eder.

```
CORE (tüm modüller paylaşır)
  users, user_profiles, sessions
  user_notifications, audit_log

TASKS modülü
  plan_items, tasks, recurring_tasks, recurring_task_instances
  categories, user_categories, plan_checklist
  journals, templates

PM modülü
  projects, project_members, workflow_statuses
  issues, issue_comments, issue_history
  sprints, labels, issue_labels

DIET modülü (yeni)
  diet_entries, diet_goals, diet_foods, diet_water_log

BUDGET modülü (yeni)
  budget_accounts, budget_transactions
  budget_categories, budget_goals
```

**Neden tek DB?**  
Cross-module sorgular transaction içinde çalışır.  
Örnek: "Issue'yu bugünkü plana ekle" → `plan_items` + `issues` tek transaction.  
Ayrı DB'de bu distributed transaction olurdu.

---

## Backend Modül Yapısı

```
packages/server/src/
├── core/
│   ├── db.ts
│   ├── redis.ts
│   ├── auth.ts
│   ├── email.ts
│   └── middleware.ts
│
├── modules/
│   ├── tasks/
│   │   ├── routes.ts      → /api/days, /api/stats, /api/recurring
│   │   ├── storage.ts
│   │   └── index.ts
│   ├── pm/
│   │   ├── routes.ts      → /api/projects
│   │   ├── storage.ts
│   │   └── index.ts
│   ├── profile/
│   │   ├── routes.ts      → /api/profile
│   │   ├── storage.ts
│   │   └── index.ts
│   ├── diet/
│   │   ├── routes.ts      → /api/diet
│   │   ├── storage.ts
│   │   └── index.ts
│   └── budget/
│       ├── routes.ts      → /api/budget
│       ├── storage.ts
│       └── index.ts
│
└── index.ts               → sadece mount eder, mantık yok
```

### Modüller Arası İletişim

Direkt import — HTTP yok, queue yok:

```ts
// pm/storage.ts içinden tasks modülüne erişim
import { createPlanItem } from "@/modules/tasks/storage";
await createPlanItem(userId, date, description);
```

İleride bir modül mikroservise çıkarılırsa import → HTTP call olur. Arayüz aynı kalır.

---

## Frontend Yapısı

```
packages/
├── shared/          → Zod şemaları + TypeScript tipleri (tüm modüller)
│   └── src/
│       ├── tasks.ts
│       ├── pm.ts
│       ├── diet.ts
│       └── budget.ts
│
├── hub-nav/         → Paylaşılan navigasyon bileşeni
│   └── src/
│       └── HubNav.tsx
│
├── gmd-web/         → gmd.byfeb.com  (task/time tracking)
├── pm-web/          → pm.byfeb.com   (proje yönetimi)
├── diet-web/        → diet.byfeb.com
└── budget-web/      → budget.byfeb.com
```

### Modüller Arası Geçiş

Basit `<a>` linki. Cookie `.byfeb.com` domain'inde olduğu için geçişte tekrar login gerekmez:

```tsx
// HubNav.tsx — her uygulamada kullanılır
const APPS = [
  { name: "Günlük",   url: "https://gmd.byfeb.com",    icon: "Clock"   },
  { name: "Projeler", url: "https://pm.byfeb.com",     icon: "Layers"  },
  { name: "Diyet",    url: "https://diet.byfeb.com",   icon: "Apple"   },
  { name: "Bütçe",    url: "https://budget.byfeb.com", icon: "Wallet"  },
];
```

---

## Auth: Tek Cookie, Tüm Subdomainler

Tek değişiklik — cookie domain'i `.byfeb.com` yap:

```ts
// packages/server/src/auth.ts
const COOKIE_BASE = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "lax" as const,
  domain: IS_PROD ? ".byfeb.com" : undefined,  // ← bu satır
};
```

CORS da güncellenmeli:

```ts
// packages/server/src/index.ts
app.use(cors({
  origin: IS_PROD
    ? (origin, cb) => {
        if (!origin || origin.endsWith(".byfeb.com")) cb(null, true);
        else cb(new Error("Not allowed"));
      }
    : true,
  credentials: true,
}));
```

---

## K8s Yapısı

```yaml
# k8s/ingress.yaml
rules:
  - host: gmd.byfeb.com     → service: gmd-frontend
  - host: pm.byfeb.com      → service: pm-frontend
  - host: diet.byfeb.com    → service: diet-frontend
  - host: budget.byfeb.com  → service: budget-frontend
  - host: api.byfeb.com     → service: backend-api

# backend: tek deployment, 2 replica
# frontend: her subdomain için ayrı deployment, 1 replica (statik dosya)
```

---

## DB Pool ve Performans

```ts
// packages/server/src/db.ts
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,          // default 10 → 20'ye çıkar
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});
```

100 kullanıcı için 2 replica × 20 connection = 40 max connection. PostgreSQL için çok rahat.

---

## Uygulama Sırası

### Faz 0 — Kritik düzeltmeler (30 dak, production'a sıfır etki)
- [ ] Cookie domain → `.byfeb.com`
- [ ] CORS → `*.byfeb.com`
- [ ] DB pool max → `20`

### Faz 1 — Backend modülerleştirme (2–3 saat)
- [ ] `storage.ts` + `routes/` → `modules/tasks/`, `modules/pm/`, `modules/profile/`
- [ ] `index.ts` sadece mount eder
- [ ] Hiçbir API değişmez, tüm testler geçer

### Faz 2 — Frontend ayrıştırma (2–3 saat)
- [ ] `packages/web` → `packages/gmd-web` (PM sayfaları çıkarılır)
- [ ] `packages/pm-web` oluşturulur
- [ ] `packages/hub-nav` paylaşılan nav bileşeni
- [ ] K8s ingress güncellenir, `api.byfeb.com` DNS eklenir

### Faz 3 — Yeni modüller (ayrı zamanlarda)
- [ ] `packages/diet-web` + `modules/diet/` + migration
- [ ] `packages/budget-web` + `modules/budget/` + migration

---

## Mikroservise Geçiş Eşiği

| Kullanıcı sayısı | Yapı |
|-----------------|------|
| 0–1.000         | Modüler monolith (bu plan) |
| 1.000–10.000    | Read replica ekle, CDN (Cloudflare free) |
| 10.000+         | Sadece darboğaz olan modülü çıkar |
| 100.000+        | O zaman konuşuruz |

**Kural:** Mikroservis ihtiyacı ölçümle belli olur, tahminle değil.

---

## Karar Özeti

| Soru | Karar |
|------|-------|
| DB paylaşımlı mı? | Evet, tek PostgreSQL |
| Auth paylaşımlı mı? | Evet, `.byfeb.com` cookie |
| Backend kaç process? | 1 (modüller import ile konuşur) |
| Frontend kaç uygulama? | Her subdomain için ayrı Vite |
| Modüller arası geçiş? | `<a href>` — cookie zaten geçerli |
| Mikroservis lazım mı? | 10.000+ kullanıcıya kadar hayır |
