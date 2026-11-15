// Purpose: The list of frontend origins allowed to call this API.
// Shared by the CORS middleware and the Stripe redirect URLs (so a booking
// request can't redirect the user to an arbitrary site after payment).

export const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    ...(process.env.EXTRA_ORIGINS || "").split(","),
    "http://localhost:5173",
    "http://localhost:5176",
    "https://cinego-chi.vercel.app",
  ]
    .map((s) => (s || "").trim().replace(/\/$/, ""))
    .filter(Boolean)
);

export function frontendOrigin(req) {
  const origin = (req.headers.origin || "").replace(/\/$/, "");
  if (origin && allowedOrigins.has(origin)) return origin;
  return (process.env.FRONTEND_URL || "https://cinego-chi.vercel.app").replace(/\/$/, "");
}
