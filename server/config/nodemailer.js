// Purpose: Central email utility used across the backend.
// This file configures SMTP using Gmail and exposes a single sendEmail function.
// All emails in the app (booking confirmation, new show alerts) go through this file.

import nodemailer from "nodemailer";

// Create an SMTP transporter using Gmail
// - host and port define the mail server
// - secure: true enables SSL (required for port 465)
// - auth uses environment variables for security
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // SSL connection for Gmail SMTP
  auth: {
    user: process.env.EMAIL_USER, // Gmail address used to send emails
    pass: process.env.EMAIL_PASS, // App password (not normal Gmail password)
  },
});

// Helper function used by the rest of the app to send emails
// Accepts recipient, subject, and HTML body
const sendEmail = async ({ to, subject, body }) => {
  return transporter.sendMail({
    from: `"CineGo 🎬" <${process.env.SENDER_EMAIL || process.env.EMAIL_USER}>`,
    to,
    subject,
    html: body,
  });
};

export default sendEmail;
