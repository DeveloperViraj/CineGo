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
import Demo from './pages/demo';                      // ← NEW (public demo page)


const App = () => {
  const { user, isLoaded } = useUser();
  const isAdminPanel = useLocation().pathname.startsWith('/admin');

  return (
    <>
      <Toaster />
      {!isAdminPanel && <Navbar />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/movies" element={<Movies />} />
        <Route path="/movies/:id" element={<Moviedetails />} />
        <Route path="/movies/:id/:date" element={<SeatLayout />} />
        <Route path="/my-bookings" element={<MyBooking />} />
        <Route path="/favourites" element={<Favourite />} />
        <Route path="/loading/:nextUrl" element={<Loading />} />

        {/* public demo route */}
        <Route path="/demo" element={<Demo />} />

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
          <Route index element={<Dashboard />} />
          <Route path="add-shows" element={<Addshow />} />
          <Route path="list-shows" element={<Listshow />} />
          <Route path="list-bookings" element={<Listbookings />} />
          <Route path="access" element={<AdminAccess />} />
        </Route>
      </Routes>

      {!isAdminPanel && <Footer />}
    </>
  );
};

export default App;
