import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail", // use Gmail service
  auth: {
    user: process.env.EMAIL_USER, // your Gmail address
    pass: process.env.EMAIL_PASS, // your 16-character App Password
  },
});

const sendEmail = async ({ to, subject, body }) => {
  try {
    const info = await transporter.sendMail({
      from: `"CineGo 🎬" <${process.env.EMAIL_USER}>`,
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
