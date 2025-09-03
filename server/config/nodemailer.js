import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,             // 465 works best for Gmail App Password
  secure: true,          // must be true for port 465
  auth: {
    user: process.env.EMAIL_USER, // your gmail
    pass: process.env.EMAIL_PASS, // your 16-char App Password
  },
  tls: {
    rejectUnauthorized: false, // prevent TLS errors on Render
  },
});

const sendEmail = async ({ to, subject, body }) => {
  try {
    const info = await transporter.sendMail({
      from: `"QuickShow 🎬" <${process.env.EMAIL_USER}>`,
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
