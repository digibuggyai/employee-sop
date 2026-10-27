// Email templates. Each function returns { subject, html, text } ready for sendMail().
// Add new emails here (leave approved, WFH request, ...) using the same layout().
//
// Email HTML is old-fashioned on purpose: tables + inline styles are what Gmail/Outlook render reliably.

const BRAND = "#12254b"; // the navy of the Digibuggy logo

// Where the "Log in" button points: the deployed app (e.g. https://team.dgbindia.com)
export const appUrl = () => (process.env.APP_URL ?? process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");

// The logo in emails must be a PUBLIC web address (Gmail/Outlook download it from the internet).
// It is the frontend file public/brand/digibuggy-logo.png. A localhost address would be a broken image in a
// real inbox, so local testing falls back to the live site.
const logoUrl = () => {
  const base = appUrl();
  return base.includes("localhost") ? "https://team.dgbindia.com/brand/digibuggy-logo.png" : `${base}/brand/digibuggy-logo.png`;
};

// Names and passwords go into HTML, so escape them (a name like "<b>" must not become markup)
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// The shared frame: logo, white card, footer
function layout(title: string, body: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
      <tr><td style="padding:0 4px 16px">
        <img src="${logoUrl()}" width="178" height="20" alt="Digibuggy" style="display:block;border:0;height:20px;width:178px">

      </td></tr>
      <tr><td style="background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:28px">
        <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${title}</h1>
        ${body}
      </td></tr>
      <tr><td style="padding:16px 4px;font-size:12px;color:#71717a">
        Sent by Digibuggy. If you weren't expecting this email, you can ignore it.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const p = (html: string) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#3f3f46">${html}</p>`;

const button = (href: string, label: string) =>
  `<p style="margin:22px 0"><a href="${href}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:8px">${label}</a></p>`;

// Login details in a grey box
const credentials = (email: string, password: string) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;margin:4px 0 8px">
  <tr><td style="padding:12px 16px;font-size:13px;color:#71717a;width:150px">Email</td>
      <td style="padding:12px 16px;font-size:14px;font-weight:600">${esc(email)}</td></tr>
  <tr><td style="padding:0 16px 12px;font-size:13px;color:#71717a">Temporary password</td>
      <td style="padding:0 16px 12px;font-size:15px;font-weight:600;font-family:Consolas,Menlo,monospace">${esc(password)}</td></tr>
</table>`;

// Sent when an admin creates an account
export function welcomeEmail(name: string, email: string, password: string) {
  const first = name.split(" ")[0];
  const url = `${appUrl()}/login`;
  return {
    subject: "Your Digibuggy account is ready",
    html: layout(
      `Welcome to Digibuggy, ${esc(first)}`,
      p("An account has been created for you. Use it to check in and out, log your daily tasks and request leave.") +
        credentials(email, password) +
        button(url, "Log in to Digibuggy") +
        p("You'll be asked to choose your own password the first time you log in.") +
        p(`On your phone, open the link and choose <b>Add to Home Screen</b> to use it like an app.`),
    ),
    text: `Welcome to Digibuggy, ${first}.\n\nAn account has been created for you.\n\nEmail: ${email}\nTemporary password: ${password}\n\nLog in: ${url}\n\nYou'll be asked to choose your own password the first time you log in.`,
  };
}

// Sent when an admin resets someone's password
export function passwordResetEmail(name: string, email: string, password: string) {
  const first = name.split(" ")[0];
  const url = `${appUrl()}/login`;
  return {
    subject: "Your Digibuggy password was reset",
    html: layout(
      "Your password was reset",
      p(`Hi ${esc(first)}, an admin has reset your password. Log in with the temporary password below.`) +
        credentials(email, password) +
        button(url, "Log in") +
        p("You'll be asked to choose a new password right after logging in. If you didn't ask for this, tell your admin."),
    ),
    text: `Hi ${first}, an admin has reset your Digibuggy password.\n\nEmail: ${email}\nTemporary password: ${password}\n\nLog in: ${url}\n\nYou'll be asked to choose a new password after logging in.`,
  };
}
