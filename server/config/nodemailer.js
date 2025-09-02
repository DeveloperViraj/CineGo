import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false, // required for Brevo with port 587
  auth: {
    user: process.env.SMTP_USER, // your Brevo SMTP login
    pass: process.env.SMTP_PASS, // your Brevo SMTP key
  },
});

const sendEmail = async ({ to, subject, body }) => {
  try {
    const info = await transporter.sendMail({
      from: `"CineGo" <${process.env.SENDER_EMAIL}>`, // must be a verified Brevo sender
      to,
      subject,
      html: body,
    });
    console.log("Message sent:", info.messageId);
    return info;
  } catch (err) {
    console.error("❌ Email send error:", err);
    throw err;
  }
};

export default sendEmail;
