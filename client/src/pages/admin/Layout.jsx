// pages/admin/Layout.jsx
import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/Appcontext';
import AdminNavbar from '../../components/AdminNavbar';
import Adminsidebar from '../../components/Adminsidebar';
import Loading from '../../components/Loading';

const Layout = () => {
  const { isAdmin, rolesReady } = useAppContext();
  const navigate = useNavigate();

  // Wait until the server has told us the roles before deciding to redirect
  useEffect(() => {
    if (rolesReady && !isAdmin) navigate('/', { replace: true });
  }, [rolesReady, isAdmin, navigate]);

  if (!rolesReady || !isAdmin) return <Loading />;

  return (
    <>
      <AdminNavbar />
      <div className="flex">
        <Adminsidebar />
        <div className="h-[calc(100vh-72px)] flex-1 overflow-y-auto px-4 py-10 md:px-10">
          <Outlet />
        </div>
      </div>
    </>
  );
};

export default Layout;
