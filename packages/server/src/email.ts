import { Resend } from "resend";
import { CATEGORY_COLORS } from "@gmd/shared";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
const APP_URL = process.env.APP_URL || "https://gmd.byfeb.com";
const FROM = process.env.FROM_EMAIL || "GMD <noreply@byfeb.com>";

// Resend istemcisi anahtar varsa kurulur. Resend constructor'ı anahtarsız
// fırlattığı için modül seviyesinde kurmak, RESEND_API_KEY tanımsız olan
// ortamlarda süreci import anında düşürüyordu (GMD-11).
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

if (!resend) {
  console.warn("[email] RESEND_API_KEY tanımlı değil — e-posta gönderimi devre dışı.");
}

interface MailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
}

// audit.ts'teki gibi fire-and-forget: e-posta hatası çağıran akışı bozmamalı.
async function sendMail(payload: MailPayload): Promise<void> {
  if (!resend) {
    console.warn(`[email] Atlandı (anahtar yok): "${payload.subject}" → ${payload.to}`);
    return;
  }
  try {
    await resend.emails.send(payload);
  } catch (err) {
    console.error(`[email] Gönderilemedi: "${payload.subject}" → ${payload.to}`, err);
  }
}

export interface ReminderEmailData {
  description: string;
  scheduledTime: string;
  itemType: "plan" | "reminder";
  category: string;
  checklistItems?: { description: string; completed: boolean }[];
}

// ── Branded HTML wrapper ──────────────────────────────────────────

function baseTemplate(body: string, preheader = ""): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>GitMyDayTime</title>
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:'Inter',system-ui,-apple-system,sans-serif;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#09090b;">
<tr><td align="center" style="padding:32px 16px;">

<!-- Header -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding-bottom:24px;text-align:center;">
  <img src="${APP_URL}/email-logo.png" width="40" height="40" alt="GMD" style="border-radius:8px;display:inline-block;vertical-align:middle;" />
  <span style="font-size:16px;font-weight:700;color:#f0f0f0;letter-spacing:-0.5px;vertical-align:middle;margin-left:10px;">GitMyDayTime</span>
</td></tr>
</table>

<!-- Content card -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#18181b;border-radius:12px;border:1px solid #27272a;">
<tr><td style="padding:28px 32px;">
${body}
</td></tr>
</table>

<!-- Footer -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding-top:20px;text-align:center;">
  <p style="margin:0;font-size:11px;color:#52525b;">
    <a href="${APP_URL}" style="color:#71717a;text-decoration:none;">gmd.byfeb.com</a>
  </p>
</td></tr>
</table>

</td></tr>
</table>
</body>
</html>`;
}

function button(href: string, text: string, color = "#f0f0f0", textColor = "#09090b"): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
<tr><td style="background-color:${color};border-radius:8px;">
  <a href="${href}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:${textColor};text-decoration:none;letter-spacing:-0.2px;">${text}</a>
</td></tr>
</table>`;
}

function badge(text: string, bgColor: string, textColor = "#fff"): string {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background-color:${bgColor};color:${textColor};letter-spacing:0.2px;">${text}</span>`;
}

// ── Email functions ───────────────────────────────────────────────

export async function sendAdminApprovalEmail(
  user: { email: string; username: string },
  approvalToken: string
): Promise<void> {
  const approveUrl = `${APP_URL}/api/auth/approve?token=${approvalToken}`;
  const body = `
    <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Yeni Kayıt</p>
    <p style="margin:0 0 20px;font-size:18px;font-weight:600;color:#f0f0f0;">${user.username}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="padding:8px 0;color:#a1a1aa;font-size:13px;width:80px;">Kullanıcı</td>
        <td style="padding:8px 0;color:#f0f0f0;font-size:13px;font-weight:500;">${user.username}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#a1a1aa;font-size:13px;border-top:1px solid #27272a;">E-posta</td>
        <td style="padding:8px 0;color:#f0f0f0;font-size:13px;font-weight:500;border-top:1px solid #27272a;">${user.email}</td>
      </tr>
    </table>
    ${button(approveUrl, "Onayla", "#4ade80", "#09090b")}
  `;
  await sendMail({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `GMD: Yeni kayıt — ${user.username}`,
    html: baseTemplate(body, `${user.username} kayıt oldu`),
  });
}

export async function sendUserApprovedEmail(
  user: { email: string; username: string },
  loginToken?: string
): Promise<void> {
  const loginUrl = loginToken ? `${APP_URL}/api/auth/auto-login?token=${loginToken}` : APP_URL;
  const body = `
    <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:#f0f0f0;">Hoş geldin, ${user.username}!</p>
    <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.6;">
      Hesabın onaylandı. Artık günlük planlarını oluşturabilir, görevlerini takip edebilir ve verimliliğini ölçebilirsin.
    </p>
    ${button(loginUrl, "Giriş Yap")}
    <p style="margin:16px 0 0;font-size:11px;color:#52525b;">Bu link tek kullanımlıktır.</p>
  `;
  await sendMail({
    from: FROM,
    to: user.email,
    subject: "Hesabın onaylandı — GitMyDayTime",
    html: baseTemplate(body, "Hesabın onaylandı, giriş yapabilirsin"),
  });
}

export async function sendReminderEmail(
  to: string,
  data: ReminderEmailData
): Promise<void> {
  const isReminder = data.itemType === "reminder";
  const label = isReminder ? "Hatırlatıcı" : "Plan";
  const labelColor = isReminder ? "#f59e0b" : "#3b82f6";
  const catColor = CATEGORY_COLORS[data.category as keyof typeof CATEGORY_COLORS] || "#6b7280";

  let checklistHtml = "";
  if (data.checklistItems && data.checklistItems.length > 0) {
    const items = data.checklistItems
      .map((cl) => {
        const icon = cl.completed ? "&#9745;" : "&#9744;";
        const style = cl.completed ? "color:#71717a;text-decoration:line-through;" : "color:#a1a1aa;";
        return `<tr><td style="padding:3px 0;font-size:13px;${style}">${icon} ${cl.description}</td></tr>`;
      })
      .join("");
    checklistHtml = `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;padding:12px 16px;background-color:#131316;border-radius:8px;width:100%;">
        ${items}
      </table>
    `;
  }

  const body = `
    <div style="margin-bottom:16px;">
      ${badge(label, labelColor)}
    </div>
    <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#f0f0f0;line-height:1.3;">
      ${data.description}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:4px 12px 4px 0;">
          <span style="font-size:13px;color:#a1a1aa;">&#128336; ${data.scheduledTime}</span>
        </td>
        <td style="padding:4px 0;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${catColor};vertical-align:middle;"></span>
          <span style="font-size:13px;color:#a1a1aa;margin-left:4px;">${data.category}</span>
        </td>
      </tr>
    </table>
    ${checklistHtml}
    ${button(`${APP_URL}`, "Uygulamayı Aç")}
  `;
  await sendMail({
    from: FROM,
    to,
    subject: `${isReminder ? "⏰" : "📋"} ${data.scheduledTime} — ${data.description}`,
    html: baseTemplate(body, `${label}: ${data.description} - ${data.scheduledTime}`),
  });
}

export async function sendProjectInvitationEmail(
  toEmail: string,
  projectName: string,
  rawToken: string
): Promise<void> {
  const APP_URL_LOCAL = process.env.APP_URL || "https://gmd.byfeb.com";
  const joinUrl = `${APP_URL_LOCAL}/projects/join/${rawToken}`;
  const body = `
    <p style="margin:0 0 6px;font-size:18px;font-weight:600;color:#f0f0f0;">Projeye Davet Edildiniz</p>
    <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.6;">
      <strong>${projectName}</strong> projesine katılmaya davet edildiniz.
      Daveti kabul etmek için aşağıdaki butona tıklayın. Davet 7 gün geçerlidir.
    </p>
    ${button(joinUrl, "Daveti Kabul Et")}
  `;
  await sendMail({
    from: FROM,
    to: toEmail,
    subject: `${projectName} — Projeye davet edildiniz`,
    html: baseTemplate(body, `${projectName} projesine katılma daveti`),
  });
}

export async function sendPasswordResetEmail(
  user: { email: string; username: string },
  token: string
): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const body = `
    <p style="margin:0 0 6px;font-size:18px;font-weight:600;color:#f0f0f0;">Şifre Sıfırlama</p>
    <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.6;">
      Merhaba ${user.username}, şifreni sıfırlamak için aşağıdaki butona tıkla. Link 1 saat geçerlidir.
    </p>
    ${button(resetUrl, "Şifremi Sıfırla")}
    <p style="margin:16px 0 0;font-size:11px;color:#52525b;">Bu isteği sen yapmadıysan bu e-postayı görmezden gel.</p>
  `;
  await sendMail({
    from: FROM,
    to: user.email,
    subject: "Şifre sıfırlama — GitMyDayTime",
    html: baseTemplate(body, "Şifre sıfırlama linki"),
  });
}

export async function sendFeedbackEmail(data: {
  senderEmail: string;
  senderUsername: string;
  type: string;
  description: string;
  url: string;
}): Promise<void> {
  const typeLabel = data.type === "bug" ? "🐛 Hata" : data.type === "feature" ? "✨ Özellik İsteği" : "💬 Diğer";
  const body = `
    <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Geri Bildirim</p>
    <p style="margin:0 0 20px;font-size:18px;font-weight:600;color:#f0f0f0;">${typeLabel}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;width:100%;">
      <tr>
        <td style="padding:8px 0;color:#a1a1aa;font-size:13px;width:100px;vertical-align:top;">Kullanıcı</td>
        <td style="padding:8px 0;color:#f0f0f0;font-size:13px;font-weight:500;">${data.senderUsername} (${data.senderEmail})</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#a1a1aa;font-size:13px;border-top:1px solid #27272a;vertical-align:top;">Sayfa</td>
        <td style="padding:8px 0;color:#71717a;font-size:12px;font-family:monospace;border-top:1px solid #27272a;">${data.url}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#a1a1aa;font-size:13px;border-top:1px solid #27272a;vertical-align:top;">Açıklama</td>
        <td style="padding:12px 0;color:#f0f0f0;font-size:13px;line-height:1.6;border-top:1px solid #27272a;">${data.description.replace(/\n/g, "<br>")}</td>
      </tr>
    </table>
  `;
  await sendMail({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `GMD Geri Bildirim: ${typeLabel} — ${data.senderUsername}`,
    html: baseTemplate(body, `${data.senderUsername} geri bildirim gönderdi`),
  });
}

export async function sendApiKeyRequestEmail(
  user: { email: string; username: string },
  requestId: string,
  reviewToken: string,
  reason?: string | null,
): Promise<void> {
  const approveUrl = `${APP_URL}/api/profile/api-key-requests/${requestId}/approve?token=${reviewToken}`;
  const body = `
    <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;font-weight:600;">API Key Talebi</p>
    <p style="margin:0 0 20px;font-size:18px;font-weight:600;color:#f0f0f0;">${user.username} API key istiyor</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;width:100%;">
      <tr>
        <td style="padding:8px 0;color:#a1a1aa;font-size:13px;width:100px;">Kullanıcı</td>
        <td style="padding:8px 0;color:#f0f0f0;font-size:13px;font-weight:500;">${user.username}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#a1a1aa;font-size:13px;border-top:1px solid #27272a;">Email</td>
        <td style="padding:8px 0;color:#71717a;font-size:13px;border-top:1px solid #27272a;">${user.email}</td>
      </tr>
      ${reason ? `
      <tr>
        <td style="padding:8px 0;color:#a1a1aa;font-size:13px;border-top:1px solid #27272a;vertical-align:top;">Amaç</td>
        <td style="padding:8px 0;color:#f0f0f0;font-size:13px;line-height:1.6;border-top:1px solid #27272a;">${reason}</td>
      </tr>` : ""}
    </table>
    ${button(approveUrl, "API Key Onayla", "#4ade80", "#09090b")}
  `;
  await sendMail({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `GMD API Key Talebi: ${user.username}`,
    html: baseTemplate(body, `${user.username} API key talep etti`),
  });
}

export async function sendApiKeyApprovedEmail(
  user: { email: string; username: string },
  rawToken: string,
): Promise<void> {
  const body = `
    <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;font-weight:600;">API Key Onaylandı</p>
    <p style="margin:0 0 12px;font-size:18px;font-weight:600;color:#f0f0f0;">API key'in hazır, ${user.username}!</p>
    <p style="margin:0 0 16px;font-size:13px;color:#a1a1aa;line-height:1.6;">API key'ini aşağıda görebilirsin. Güvenli bir yere kaydet — bu mail tekrar gönderilmeyecek.</p>
    <div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:14px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">API Key</p>
      <p style="margin:0;font-size:12px;color:#4ade80;font-family:monospace;word-break:break-all;">${rawToken}</p>
    </div>
    <p style="margin:0 0 16px;font-size:12px;color:#71717a;">Ayarlar → API Tokens bölümünden token'larını yönetebilirsin.</p>
    ${button(APP_URL + "/profile", "Ayarlara Git")}
  `;
  await sendMail({
    from: FROM,
    to: user.email,
    subject: "GMD API Key'in Hazır",
    html: baseTemplate(body, "API key'in onaylandı"),
  });
}

export async function sendVerificationEmail(
  user: { email: string; username: string },
  token: string
): Promise<void> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
  const body = `
    <p style="margin:0 0 6px;font-size:18px;font-weight:600;color:#f0f0f0;">E-postanı Doğrula</p>
    <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.6;">
      Merhaba ${user.username}, e-posta adresini doğrulamak için aşağıdaki butona tıkla. Link 24 saat geçerlidir.
    </p>
    ${button(verifyUrl, "E-postamı Doğrula")}
  `;
  await sendMail({
    from: FROM,
    to: user.email,
    subject: "E-postanı doğrula — GitMyDayTime",
    html: baseTemplate(body, "E-posta doğrulama linki"),
  });
}

// ── Weekly recap ─────────────────────────────────────────────────

export interface WeeklyRecapEmailData {
  weekStart: string; // ISO date
  weekEnd: string;   // ISO date
  totalCompleted: number;
  totalMinutes: number;
  mostProductiveDay: { date: string; count: number } | null;
  topCategory: { label: string; count: number } | null;
}

function formatHourMin(min: number): string {
  if (min <= 0) return "0d";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}d`;
  if (m === 0) return `${h}s`;
  return `${h}s ${m}d`;
}

function formatTrDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
  });
}

function formatTrWeekday(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("tr-TR", {
    weekday: "long",
  });
}

export async function sendWeeklyRecapEmail(
  user: { email: string; username: string },
  data: WeeklyRecapEmailData,
): Promise<void> {
  const range = `${formatTrDate(data.weekStart)} – ${formatTrDate(data.weekEnd)}`;

  const bestDayRow = data.mostProductiveDay
    ? `<tr>
        <td style="padding:10px 0;color:#a1a1aa;font-size:13px;border-top:1px solid #27272a;">En verimli gün</td>
        <td style="padding:10px 0;color:#f0f0f0;font-size:13px;font-weight:500;text-align:right;border-top:1px solid #27272a;">
          ${formatTrWeekday(data.mostProductiveDay.date)} · ${data.mostProductiveDay.count} görev
        </td>
      </tr>`
    : "";

  const topCatRow = data.topCategory
    ? `<tr>
        <td style="padding:10px 0;color:#a1a1aa;font-size:13px;border-top:1px solid #27272a;">En çok kategori</td>
        <td style="padding:10px 0;color:#f0f0f0;font-size:13px;font-weight:500;text-align:right;border-top:1px solid #27272a;">
          ${data.topCategory.label} · ${data.topCategory.count}
        </td>
      </tr>`
    : "";

  const body = `
    <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Haftalık Özet</p>
    <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:#f0f0f0;">Merhaba ${user.username}</p>
    <p style="margin:0 0 24px;font-size:14px;color:#a1a1aa;">${range}</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
      <tr>
        <td style="padding:10px 0;color:#a1a1aa;font-size:13px;">Tamamlanan görev</td>
        <td style="padding:10px 0;color:#f0f0f0;font-size:13px;font-weight:500;text-align:right;">${data.totalCompleted}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#a1a1aa;font-size:13px;border-top:1px solid #27272a;">Harcanan süre</td>
        <td style="padding:10px 0;color:#f0f0f0;font-size:13px;font-weight:500;text-align:right;border-top:1px solid #27272a;">${formatHourMin(data.totalMinutes)}</td>
      </tr>
      ${bestDayRow}
      ${topCatRow}
    </table>

    ${button(APP_URL, "Bu haftayı planla")}
    <p style="margin:20px 0 0;font-size:11px;color:#52525b;line-height:1.5;">
      Haftalık özetleri artık almak istemiyorsan Profil → Bildirimler'den kapatabilirsin.
    </p>
  `;

  await sendMail({
    from: FROM,
    to: user.email,
    subject: `Haftalık özet · ${range}`,
    html: baseTemplate(body, `${data.totalCompleted} görev, ${formatHourMin(data.totalMinutes)} harcama`),
  });
}
