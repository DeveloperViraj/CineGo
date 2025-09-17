// Purpose: Provide application-wide shared state and API utilities (axios instance, auth helpers, cached data, and refresh triggers).
// Notes:
// This file centralizes calls to backend APIs (shows, favorites, admin checks).
// It exposes a configured axios instance and token helper so components do not reimplement auth logic.

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useAuth, useUser } from '@clerk/clerk-react';

// Configure axios base URL for all API requests.
// Keep this here so every component using `axios` from context has a consistent base.
axios.defaults.baseURL = import.meta.env.VITE_BASE_URL || 'http://localhost:3000/api';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // UI / role flags
  // isAdmin / isOwner reflect server-validated roles; checking* flags indicate an in-flight check
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  const [isOwner, setIsOwner] = useState(false);
  const [checkingOwner, setCheckingOwner] = useState(false);

  // Cached data
  const [shows, setShows] = useState([]); // list of shows/movies used across the app
  const [favorites, setFavorites] = useState([]); // user's favorite movies (requires auth)

  // Refresh triggers
  // Toggle these flags to force consumers to re-fetch data
  const [refreshMoviesFlag, setRefreshMoviesFlag] = useState(false);
  const [refreshFavoritesFlag, setRefreshFavoritesFlag] = useState(false);

  // Clerk hooks for auth information & token retrieval
  const { user } = useUser();
  const { getToken } = useAuth();
  const location = useLocation();

  // Role checks (server-validated)
  // fetchIsAdmin: ask backend whether current user has admin privileges
  const fetchIsAdmin = useCallback(async () => {
    setCheckingAdmin(true);
    try {
      const token = await getToken();
      const { data } = await axios.get('/api/admin/isAdmin', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsAdmin(data.isAdmin === true);
    } catch (error) {
      // On any error assume non-admin for safety
      setIsAdmin(false);
    } finally {
      setCheckingAdmin(false);
    }
  }, [getToken]);

  // fetchIsOwner: asks backend if current user is the owner (app-specific role)
  const fetchIsOwner = useCallback(async () => {
    setCheckingOwner(true);
    try {
      const token = await getToken();
      const { data } = await axios.get('/api/admin/isOwner', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsOwner(data?.isOwner === true);
    } catch {
      setIsOwner(false);
    } finally {
      setCheckingOwner(false);
    }
  }, [getToken]);

  // Shows (movies) fetching
  // Guard to avoid concurrent fetches in a single session.
  let fetchShowsInFlight = false;
  const fetchShows = useCallback(async () => {
    if (fetchShowsInFlight) return;
    fetchShowsInFlight = true;
    try {
      const { data } = await axios.get('/api/show/getmovies');
      if (data?.success) setShows(data.shows || []);
      else toast.error(data?.message || 'Failed to load shows');
    } catch (error) {
      console.error('Error fetching shows:', error);
      toast.error('Failed to fetch shows');
    } finally {
      fetchShowsInFlight = false;
    }
  }, []);

  // Favorites (user-specific)
  // Requires authentication — retrieves the user's favorite movies from backend
  const fetchFavorites = useCallback(async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get('/api/user/getfavorites', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data?.success) setFavorites(data.movies || []);
      else toast.error(data?.message || 'Failed to load favourites');
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast.error('Failed to fetch favourites');
    }
  }, [getToken]);

  // Refresh helpers exposed to components
  const bumpMovies = useCallback(() => setRefreshMoviesFlag((p) => !p), []);
  const bumpFavorites = useCallback(() => setRefreshFavoritesFlag((p) => !p), []);

  // Effects: run checks & fetches at appropriate times
  // When user changes (login/logout), refresh role flags
  useEffect(() => {
    if (user) {
      fetchIsAdmin();
      fetchIsOwner();
    } else {
      setIsAdmin(false);
      setIsOwner(false);
    }
  }, [user, fetchIsAdmin, fetchIsOwner]);

  // Fetch shows on mount and whenever refreshMoviesFlag toggles
  useEffect(() => {
    fetchShows();
  }, [fetchShows, refreshMoviesFlag]);

  // Fetch favorites when on /favourites page or when refreshFavoritesFlag toggles
  useEffect(() => {
    if (user && (location.pathname === '/favourites' || refreshFavoritesFlag)) {
      fetchFavorites();
    }
  }, [user, location.pathname, refreshFavoritesFlag, fetchFavorites]);

  // Context value exposed to consumers
  return (
    <AppContext.Provider
      value={{
        // Data
        shows,
        favorites,
        isAdmin,
        isOwner,
        checkingAdmin,
        checkingOwner,

        // API helpers
        fetchIsAdmin,
        fetchIsOwner,
        fetchFavorites,
        getToken,
        axios,

        // User
        user,

        // Triggers
        bumpMovies,
        bumpFavorites,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);