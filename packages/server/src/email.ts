import { Resend } from "resend";
import { CATEGORY_COLORS } from "@gmd/shared";

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
const APP_URL = process.env.APP_URL || "https://gmd.byfeb.com";
const FROM = process.env.FROM_EMAIL || "GMD <noreply@byfeb.com>";

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
  await resend.emails.send({
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
  await resend.emails.send({
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
  await resend.emails.send({
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
  await resend.emails.send({
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
  await resend.emails.send({
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
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `GMD Geri Bildirim: ${typeLabel} — ${data.senderUsername}`,
    html: baseTemplate(body, `${data.senderUsername} geri bildirim gönderdi`),
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
  await resend.emails.send({
    from: FROM,
    to: user.email,
    subject: "E-postanı doğrula — GitMyDayTime",
    html: baseTemplate(body, "E-posta doğrulama linki"),
  });
}
