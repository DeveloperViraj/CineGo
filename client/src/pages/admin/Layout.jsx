// pages/admin/Layout.jsx
import React, { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../../context/Appcontext';
import AdminNavbar from '../../components/AdminNavbar';
import Adminsidebar from '../../components/Adminsidebar';
import Loading from '../../components/Loading';

const Layout = () => {
  const {
    isAdmin, isOwner,
    checkingAdmin, checkingOwner,
    fetchIsAdmin, fetchIsOwner
  } = useAppContext();

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchIsAdmin();
    fetchIsOwner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const waiting = checkingAdmin || checkingOwner;
  const path = location.pathname;

  useEffect(() => {
    if (waiting) return;

    // Owner-only page
    if (path.startsWith("/admin/access")) {
      if (!isOwner) navigate("/");
      return;
    }

    // All other /admin pages require admin
    if (path.startsWith("/admin") && !isAdmin) {
      navigate("/");
    }
  }, [waiting, isAdmin, isOwner, path, navigate]);

  if (waiting) return <Loading />;

  return (
    <>
      <AdminNavbar />
      <div className="flex">
        <Adminsidebar />
        <div className="flex flex-1 justify-center px-4 py-10 md:px-10 h-[calc(100vh-72px)] overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </>
  );
};

export default Layout;
