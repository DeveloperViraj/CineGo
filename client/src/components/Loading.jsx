import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// Generic full-page spinner. When used as /loading/:nextUrl (Stripe success page)
// it shows a short confirmation message and then forwards to `nextUrl`.
// (It used to wait a fixed 8 seconds; My Bookings now polls until the payment is confirmed.)
const Loading = () => {
  const { nextUrl } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!nextUrl) return;
    const t = setTimeout(() => navigate('/' + nextUrl, { replace: true }), 2500);
    return () => clearTimeout(t);
  }, [nextUrl, navigate]);

  return (
    <div className="flex h-[100vh] flex-col items-center justify-center gap-5">
      <div className="h-14 w-14 animate-spin rounded-full border-2 border-white/10 border-t-primary" />
      {nextUrl && <p className="text-gray-300">Payment received — confirming your booking…</p>}
    </div>
  );
};

export default Loading;
