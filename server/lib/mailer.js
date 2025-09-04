import nodemailer from "nodemailer";

let transporter;

function getTx() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.warn("⚠️ SMTP not fully configured. Emails will be dry-run logged.");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  const tx = getTx();
  const from = process.env.EMAIL_FROM || "CineGo <no-reply@cinego.app>";
  if (!tx) {
    console.log("📭 [dry-run] email ->", { to, subject });
    return;
  }
  const info = await tx.sendMail({ from, to, subject, text, html });
  console.log("📨 Nodemailer accepted:", info.messageId);
}
