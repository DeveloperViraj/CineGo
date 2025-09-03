import nodemailer from "nodemailer";

console.log("👉 EMAIL_USER:", process.env.EMAIL_USER || "NOT SET");
console.log("👉 EMAIL_PASS exists?", !!process.env.EMAIL_PASS);

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,            // Gmail SSL port
  secure: true,         // must be true for port 465
  auth: {
    user: process.env.EMAIL_USER,  // full Gmail (same as SENDER_EMAIL)
    pass: process.env.EMAIL_PASS,  // Google App Password
  },
});

const sendEmail = async ({ to, subject, body }) => {
  try {
    const info = await transporter.sendMail({
      from: `"CineGo 🎬" <${process.env.SENDER_EMAIL || process.env.EMAIL_USER}>`,
      to,
      subject,
      html: body,
    });

    console.log("✅ Email sent:", info.messageId);
    return info;
  } catch (err) {
    console.error("❌ Email send error:", err);
    throw err;
  }
};

export default sendEmail;
