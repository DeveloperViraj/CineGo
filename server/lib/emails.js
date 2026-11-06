// Purpose: HTML templates for transactional emails.
// (Commit 737324f accidentally replaced both bodies with the literal text "..." —
// these are the original templates, restored and shared by every sender.)

const SITE = () => (process.env.FRONTEND_URL || "https://cinego-chi.vercel.app").replace(/\/$/, "");
const TZ = () => process.env.APP_TIMEZONE || "Asia/Kolkata";

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]
  );

export function formatShowTime(date) {
  const d = new Date(date);
  return {
    date: d.toLocaleDateString("en-IN", { timeZone: TZ(), weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { timeZone: TZ(), hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

export function bookingConfirmationEmail({ name, movie, showDateTime, bookingId, seats = [], amount }) {
  const { date, time } = showDateTime ? formatShowTime(showDateTime) : {};
  const title = movie?.originalTitle || "your movie";
  return {
    subject: `Booking confirmed: '${title}'`,
    body: `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
      <div style="background-color:#7b2cbf;color:white;padding:20px;text-align:center;">
        <h1 style="margin:0;">🎟️ CineGo Booking Confirmed!</h1>
      </div>
      <div style="padding:24px;font-size:16px;color:#333;">
        ${name ? `<h2 style="margin-top:0;">Hi ${esc(name)},</h2>` : ""}
        <p>Your booking for <strong style="color:#7b2cbf;">"${esc(title)}"</strong> is confirmed.</p>
        ${date ? `<p><strong>Date:</strong> ${esc(date)}<br><strong>Time:</strong> ${esc(time)}</p>` : ""}
        <p><strong>Booking ID:</strong> <span style="color:#7b2cbf;">${esc(bookingId)}</span></p>
        ${seats.length ? `<p><strong>Seats:</strong> ${esc(seats.join(", "))}</p>` : ""}
        ${amount != null ? `<p><strong>Amount paid:</strong> ₹${esc(amount)}</p>` : ""}
        <p>🎬 Enjoy the show and don’t forget to grab your popcorn!</p>
      </div>
      ${movie?.primaryImage ? `<img src="${esc(movie.primaryImage)}" alt="${esc(title)} Poster" style="width:100%;max-height:350px;object-fit:cover;" />` : ""}
      <div style="background-color:#f5f5f5;color:#777;padding:16px;text-align:center;font-size:14px;">
        <p style="margin:0;">Thanks for booking with us!<br>— The CineGo Team</p>
        <p style="margin:4px 0 0;">📍 <a href="${SITE()}/my-bookings" style="color:#7b2cbf;text-decoration:none;">View your bookings</a></p>
      </div>
    </div>`,
  };
}

export function newMovieEmail({ name, movie }) {
  return {
    subject: `🎬 Now showing: ${movie.originalTitle}`,
    body: `
    <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;border:1px solid #ddd;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
      <div style="background-color:#7b2cbf;color:white;padding:20px;text-align:center;">
        <h1 style="margin:0;">Hi ${esc(name || "there")},</h1>
      </div>
      <div style="padding:24px;color:#333;">
        <h2 style="margin-top:0;">"${esc(movie.originalTitle)}" is now available on CineGo!</h2>
        ${movie.releaseDate ? `<p><strong>Release Date:</strong> ${esc(movie.releaseDate)}</p>` : ""}
        ${movie.genres?.length ? `<p><strong>Genre:</strong> ${esc(movie.genres.join(", "))}</p>` : ""}
        <p>${esc(movie.description)}</p>
        ${movie.primaryImage ? `<img src="${esc(movie.primaryImage)}" alt="${esc(movie.originalTitle)} Poster" style="width:100%;max-height:350px;object-fit:cover;border-radius:4px;margin-top:16px;" />` : ""}
        <div style="margin-top:20px;text-align:center;">
          <a href="${SITE()}/movies/${movie._id}" style="background-color:#7b2cbf;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">🎟️ Book Your Tickets</a>
        </div>
      </div>
      <div style="background-color:#f5f5f5;color:#777;padding:16px;text-align:center;font-size:14px;">
        <p style="margin:0;">Thanks for staying with CineGo!<br>We bring the cinema to your fingertips.</p>
      </div>
    </div>`,
  };
}
