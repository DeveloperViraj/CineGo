// server/config/nodemailer.js
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: process.env.EMAIL_PORT || 465,
  secure: process.env.EMAIL_PORT == 465, // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER, // your Gmail address or SMTP user
    pass: process.env.EMAIL_PASS, // Gmail App Password or SMTP key
  },
});

const sendEmail = async ({ to, subject, body }) => {
  try {
    const info = await transporter.sendMail({
      from: `"QuickShow 🎬" <${process.env.EMAIL_USER}>`, // sender must match your verified account
      to,
      subject,
      html: body,
    });

    console.log("✅ Email sent:", info.messageId);
    return info;
  } catch (err) {
    console.error("❌ Email send error:", err.message || err);
    throw err;
  }
};

export default sendEmail;
