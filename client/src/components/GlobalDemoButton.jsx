import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/Appcontext";

const DEMO = import.meta.env.VITE_DEMO_MODE === "1";

export default function GlobalDemoButton() {
  const navigate = useNavigate();
  const { isAdmin } = useAppContext();

  // Only show when demo mode is on (so it won't appear in prod if you turn it off)
  if (!DEMO) return null;

  const go = () => navigate(isAdmin ? "/admin" : "/demo");

  return (
    <button
      onClick={go}
      className="
        fixed z-40 top-6 right-24
        px-3 py-1.5 rounded-full text-sm font-medium
        backdrop-blur bg-white/10 border border-white/20
        hover:bg-white/20 transition
      "
      title={isAdmin ? "Open admin panel" : "Preview admin with demo passcode"}
    >
      {isAdmin ? "Admin Panel" : "Try Admin (Demo)"}
    </button>
  );
}
