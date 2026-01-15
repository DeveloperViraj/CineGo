import Navbar from './components/Navbar';
import { Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Movies from './pages/Movies';
import Moviedetails from './pages/Moviedetails';
import SeatLayout from './pages/SeatLayout';
import MyBooking from './pages/MyBooking';
import Favourite from './pages/Favourite';
import Footer from './components/Footer';
import { Toaster } from 'react-hot-toast';
import Layout from './pages/admin/Layout';
import Dashboard from './pages/admin/Dashboard';
import Addshow from './pages/admin/Addshow';
import Listshow from './pages/admin/Listshow';
import Listbookings from './pages/admin/Listbookings';
import { SignIn, useUser } from '@clerk/clerk-react';
import Loading from './components/Loading';
import AdminAccess from './pages/admin/AdminAccess';
import Demo from './pages/demo';

const App = () => {
  // Clerk hook to get authentication state and user info
  const { user, isLoaded } = useUser();

  // Used to detect admin routes so shared UI (Navbar/Footer) can be hidden
  const isAdminPanel = useLocation().pathname.startsWith('/admin');

  return (
    <>
      {/* Global toast notifications for success/error messages */}
      <Toaster />

      {/* Navbar is hidden for admin pages to keep admin UI separate */}
      {!isAdminPanel && <Navbar />}

      {/* Application route definitions */}
      <Routes>
        {/* Public user routes */}
        <Route path="/" element={<Home />} />
        <Route path="/movies" element={<Movies />} />
        <Route path="/movies/:id" element={<Moviedetails />} />
        <Route path="/movies/:id/:date" element={<SeatLayout />} />
        <Route path="/my-bookings" element={<MyBooking />} />
        <Route path="/favourites" element={<Favourite />} />
        <Route path="/loading/:nextUrl" element={<Loading />} />

        {/* Public demo route used for sandbox/testing */}
        <Route path="/demo" element={<Demo />} />

        {/* Admin routes */}
        {/* Authentication is handled here before rendering admin layout */}
        <Route
          path="/admin/*"
          element={
            isLoaded ? (
              user ? (
                <Layout />
              ) : (
                <div className="min-h-screen flex items-center justify-center">
                  <SignIn fallbackRedirectUrl="/admin" />
                </div>
              )
            ) : (
              <Loading />
            )
          }
        >
          {/* Nested admin routes */}
          <Route index element={<Dashboard />} />
          <Route path="add-shows" element={<Addshow />} />
          <Route path="list-shows" element={<Listshow />} />
          <Route path="list-bookings" element={<Listbookings />} />
          <Route path="access" element={<AdminAccess />} />
        </Route>
      </Routes>

      {/* Footer is hidden for admin pages */}
      {!isAdminPanel && <Footer />}
    </>
  );
};

export default App;
