import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAppContext } from '../context/Appcontext';

const AdminNavbar = () => {
  const { isDemo } = useAppContext();
  return (
    <div className="flex h-18 items-center justify-between border-b border-gray-300/20 px-16 md:px-10">
      <Link to="/" className="flex items-center gap-3">
        <img src="/navlogo.webp" alt="CineGo" width="112" height="40" className="h-auto w-28" />
        {isDemo && (
          <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-300">Demo mode</span>
        )}
      </Link>
      <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white max-sm:hidden">
        <ArrowLeft className="h-4 w-4" /> Back to site
      </Link>
    </div>
  );
};

export default AdminNavbar;
