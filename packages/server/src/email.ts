import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
const APP_URL = process.env.APP_URL || "https://gmd.byfeb.com";
const FROM = process.env.FROM_EMAIL || "GMD <noreply@byfeb.com>";

export async function sendAdminApprovalEmail(
  user: { email: string; username: string },
  approvalToken: string
): Promise<void> {
  const approveUrl = `${APP_URL}/api/auth/approve?token=${approvalToken}`;
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `GMD: Yeni kayıt — ${user.username}`,
    html: `
      <p><strong>Yeni kullanıcı kayıt oldu:</strong></p>
      <p>Kullanıcı adı: <strong>${user.username}</strong></p>
      <p>Email: <strong>${user.email}</strong></p>
      <br/>
      <a href="${approveUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 24px;text-decoration:none;border-radius:6px;font-weight:600;">Onayla</a>
    `,
  });
}

export async function sendUserApprovedEmail(user: { email: string; username: string }): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to: user.email,
    subject: "GitMyDayTime hesabınız onaylandı",
    html: `
      <p>Merhaba ${user.username},</p>
      <p>Hesabınız onaylandı. Artık giriş yapabilirsiniz.</p>
      <br/>
      <a href="${APP_URL}" style="display:inline-block;background:#000;color:#fff;padding:10px 24px;text-decoration:none;border-radius:6px;font-weight:600;">Uygulamaya git</a>
    `,
  });
}

export async function sendReminderEmail(
  to: string,
  description: string,
  scheduledTime: string
): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `⏰ ${scheduledTime} — ${description}`,
    html: `
      <p>Hatırlatıcınız:</p>
      <p style="font-size:18px;font-weight:600;">${description}</p>
      <p style="color:#666;">Saat: ${scheduledTime}</p>
    `,
  });
}

export async function sendVerificationEmail(
  user: { email: string; username: string },
  token: string
): Promise<void> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to: user.email,
    subject: "Email adresinizi doğrulayın — GitMyDayTime",
    html: `
      <p>Merhaba ${user.username},</p>
      <p>Email adresinizi doğrulamak için aşağıdaki butona tıklayın. Link 24 saat geçerlidir.</p>
      <br/>
      <a href="${verifyUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 24px;text-decoration:none;border-radius:6px;font-weight:600;">Email adresimi doğrula</a>
    `,
  });
}
