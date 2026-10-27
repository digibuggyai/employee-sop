// Sends email through Resend's HTTPS API.
// Why not SMTP (Gmail, Hostinger mail)? Railway blocks outgoing SMTP ports on Free/Hobby plans,
// so SMTP would work on a laptop and silently fail in production. An HTTPS API always works.
//
// Settings (backend/.env locally, Railway → Variables in production):
//   RESEND_API_KEY  re_...                              (resend.com → API Keys)
//   MAIL_FROM       Digibuggy <hub@dgbindia.com>    (an address on a domain verified in Resend)
// Without RESEND_API_KEY, emails are printed to the terminal instead of sent (handy while developing).

export type Mail = { to: string; subject: string; html: string; text: string };
export type MailResult = { sent: true } | { sent: false; reason: string };

const API_URL = process.env.RESEND_API_URL ?? "https://api.resend.com/emails";

export async function sendMail(mail: Mail): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM ?? "Digibuggy <onboarding@resend.dev>";

  if (!key) {
    console.log(`\n[mail not configured] To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n`);
    return { sent: false, reason: "Email isn't set up yet (RESEND_API_KEY is missing)" };
  }

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
      signal: AbortSignal.timeout(10_000), // never let a slow email service hang a request
    });
    if (res.ok) return { sent: true };
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    console.error("Resend rejected the email:", res.status, body);
    return { sent: false, reason: body.message ?? `Email service answered ${res.status}` };
  } catch (err) {
    console.error("Could not reach the email service:", err);
    return { sent: false, reason: "Could not reach the email service" };
  }
}
