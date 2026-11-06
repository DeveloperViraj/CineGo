import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SignIn, useUser } from '@clerk/clerk-react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Loading from './components/Loading';
import Home from './pages/Home';

// Everything except the home page is loaded on demand, so the first visit
// downloads (and parses) much less JavaScript before movies can render.
const Movies = lazy(() => import('./pages/Movies'));
const Moviedetails = lazy(() => import('./pages/Moviedetails'));
const SeatLayout = lazy(() => import('./pages/SeatLayout'));
const MyBooking = lazy(() => import('./pages/MyBooking'));
const Favourite = lazy(() => import('./pages/Favourite'));
const Demo = lazy(() => import('./pages/demo'));
const Layout = lazy(() => import('./pages/admin/Layout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Addshow = lazy(() => import('./pages/admin/Addshow'));
const Listshow = lazy(() => import('./pages/admin/Listshow'));
const Listbookings = lazy(() => import('./pages/admin/Listbookings'));
const AdminAccess = lazy(() => import('./pages/admin/AdminAccess'));

// Scroll to top whenever the page (not the query string) changes
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    // 'instant' overrides the global scroll-smooth so new pages don't animate from the old position
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
};

const App = () => {
  const { user, isLoaded } = useUser();
  const isAdminPanel = useLocation().pathname.startsWith('/admin');

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{ style: { background: '#1c1a22', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }}
      />
      <ScrollToTop />

      {!isAdminPanel && <Navbar />}

      <main className="min-h-[70vh] overflow-x-clip">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/movies" element={<Movies />} />
            <Route path="/movies/:id" element={<Moviedetails />} />
            <Route path="/movies/:id/:date" element={<SeatLayout />} />
            <Route path="/my-bookings" element={<MyBooking />} />
            <Route path="/favourites" element={<Favourite />} />
            <Route path="/loading/:nextUrl" element={<Loading />} />
            <Route path="/demo" element={<Demo />} />

            <Route
              path="/admin/*"
              element={
                isLoaded ? (
                  user ? (
                    <Layout />
                  ) : (
                    <div className="flex min-h-screen items-center justify-center">
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

            <Route
              path="*"
              element={
                <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 pt-24 text-center">
                  <p className="text-6xl font-bold text-primary-dull">404</p>
                  <p className="text-gray-400">This page doesn&apos;t exist.</p>
                  <a href="/" className="mt-2 rounded-full bg-primary px-5 py-2 text-sm font-medium hover:bg-primary-dull">
                    Go home
                  </a>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </main>

      {!isAdminPanel && <Footer />}
    </>
  );
};

export default App;
