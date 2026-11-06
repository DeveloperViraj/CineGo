// Purpose: Provide application-wide shared state and API utilities
// (axios instance, auth helpers, cached movie list, favourites and roles).

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth, useUser } from '@clerk/clerk-react';
import { axios, fetchMovies, initialMoviesRequest, readCachedMovies } from '../lib/api';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // Roles (server-validated). One request returns admin + owner + demo flags.
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [checkingRoles, setCheckingRoles] = useState(false);
  // True once roles are known for the current user (prevents admin pages from
  // redirecting away before the check has even started)
  const [rolesReady, setRolesReady] = useState(false);

  // Movies: start from the local cache so the page renders instantly
  const [shows, setShows] = useState(() => readCachedMovies() || []);
  const [moviesLoading, setMoviesLoading] = useState(() => !readCachedMovies()?.length);
  const [moviesError, setMoviesError] = useState(false);

  // Favourites (full movie docs) for the signed-in user
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  const { user, isLoaded: userLoaded } = useUser();
  const { getToken } = useAuth();
  const userId = user?.id;

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  // ---------- roles ----------
  const rolesRequest = useRef(null);
  const fetchRoles = useCallback(async () => {
    if (rolesRequest.current) return rolesRequest.current;
    setCheckingRoles(true);
    rolesRequest.current = (async () => {
      try {
        const { data } = await axios.get('/api/admin/isAdmin', { headers: await authHeaders() });
        setIsAdmin(data?.isAdmin === true);
        setIsOwner(data?.isOwner === true);
        setIsDemo(data?.isDemo === true);
      } catch {
        setIsAdmin(false);
        setIsOwner(false);
        setIsDemo(false);
      } finally {
        setCheckingRoles(false);
        setRolesReady(true);
        rolesRequest.current = null;
      }
    })();
    return rolesRequest.current;
  }, [authHeaders]);

  // ---------- movies ----------
  const firstLoad = useRef(true);
  const loadMovies = useCallback(async ({ fresh = false } = {}) => {
    const request = firstLoad.current && !fresh ? initialMoviesRequest : fetchMovies({ fresh });
    firstLoad.current = false;
    try {
      const list = await request;
      setShows(list);
      setMoviesError(false);
    } catch (error) {
      console.error('Error fetching movies:', error);
      setMoviesError(true);
      // Only shout if we have nothing to show
      if (!readCachedMovies()?.length) toast.error('Could not load movies. Retrying…', { id: 'movies' });
    } finally {
      setMoviesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMovies();
  }, [loadMovies]);

  // Retry automatically if the first attempt failed (e.g. a sleeping free-tier server)
  useEffect(() => {
    if (!moviesError) return;
    const t = setTimeout(() => loadMovies({ fresh: true }), 4000);
    return () => clearTimeout(t);
  }, [moviesError, loadMovies]);

  // Refresh when the tab becomes visible again after a while
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 5 * 60 * 1000) loadMovies({ fresh: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [loadMovies]);

  const bumpMovies = useCallback(() => loadMovies({ fresh: true }), [loadMovies]);

  // ---------- favourites ----------
  const fetchFavorites = useCallback(async () => {
    setFavoritesLoading(true);
    try {
      const { data } = await axios.get('/api/user/getfavorites', { headers: await authHeaders() });
      if (data?.success) setFavorites(data.movies || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setFavoritesLoading(false);
    }
  }, [authHeaders]);

  // Optimistic toggle: the heart flips immediately, rolls back on failure
  const toggleFavorite = useCallback(
    async (movie) => {
      if (!userId) {
        toast.error('Please sign in to save favourites');
        return;
      }
      const id = movie?._id;
      if (!id) return;
      const wasFav = favorites.some((m) => m._id === id);
      setFavorites((prev) => (wasFav ? prev.filter((m) => m._id !== id) : [...prev, movie]));
      try {
        const { data } = await axios.post('/api/user/updatefavorites', { movieId: id }, { headers: await authHeaders() });
        if (!data?.success) throw new Error(data?.message);
        toast.success(data.message || 'Favourites updated', { id: 'fav' });
      } catch {
        setFavorites((prev) => (wasFav ? [...prev, movie] : prev.filter((m) => m._id !== id)));
        toast.error('Could not update favourites', { id: 'fav' });
      }
    },
    [userId, favorites, authHeaders]
  );

  const bumpFavorites = fetchFavorites;

  // ---------- user changes ----------
  useEffect(() => {
    if (!userLoaded) return;
    if (userId) {
      setRolesReady(false);
      fetchRoles();
      fetchFavorites();
    } else {
      setIsAdmin(false);
      setIsOwner(false);
      setIsDemo(false);
      setFavorites([]);
      setRolesReady(true);
    }
  }, [userId, userLoaded, fetchRoles, fetchFavorites]);

  return (
    <AppContext.Provider
      value={{
        // Data
        shows,
        moviesLoading,
        moviesError,
        favorites,
        favoritesLoading,
        isAdmin,
        isOwner,
        isDemo,
        checkingAdmin: checkingRoles,
        checkingOwner: checkingRoles,
        checkingRoles,
        rolesReady,

        // API helpers
        fetchIsAdmin: fetchRoles,
        fetchIsOwner: fetchRoles,
        fetchRoles,
        fetchFavorites,
        toggleFavorite,
        getToken,
        authHeaders,
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

// eslint-disable-next-line react-refresh/only-export-components
export const useAppContext = () => useContext(AppContext);
