import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // SSL for Gmail
  auth: {
    user: process.env.EMAIL_USER, // Gmail address
    pass: process.env.EMAIL_PASS, // App password
  },
});

const sendEmail = async ({ to, subject, body }) => {
  return transporter.sendMail({
    from: `"CineGo 🎬" <${process.env.SENDER_EMAIL || process.env.EMAIL_USER}>`,
    to,
    subject,
    html: body,
  });
};

export default sendEmail;
