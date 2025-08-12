// context/Appcontext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useAuth, useUser } from "@clerk/clerk-react";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  const [isOwner, setIsOwner] = useState(false);
  const [checkingOwner, setCheckingOwner] = useState(false);

  const [shows, setShows] = useState([]);
  const [favorites, setFavorites] = useState([]);

  const [refreshMoviesFlag, setRefreshMoviesFlag] = useState(false);
  const [refreshFavoritesFlag, setRefreshFavoritesFlag] = useState(false);

  const { user } = useUser();
  const { getToken } = useAuth();
  const location = useLocation();

  const fetchIsAdmin = async () => {
    setCheckingAdmin(true);
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/admin/isAdmin", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsAdmin(data.isAdmin === true);
    } catch (error) {
      setIsAdmin(false);
    } finally {
      setCheckingAdmin(false);
    }
  };

  const fetchIsOwner = async () => {
    setCheckingOwner(true);
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/admin/isOwner", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsOwner(data?.isOwner === true);
    } catch {
      setIsOwner(false);
    } finally {
      setCheckingOwner(false);
    }
  };

  // ------- movies --------
  let fetchShowsInFlight = false;
  const fetchShows = useCallback(async () => {
    if (fetchShowsInFlight) return;
    fetchShowsInFlight = true;
    try {
      const { data } = await axios.get("/api/show/getmovies");
      if (data.success) setShows(data.shows);
      else toast.error(data.message);
    } catch (error) {
      console.error("Error fetching shows:", error);
      toast.error("Failed to fetch shows");
    } finally {
      fetchShowsInFlight = false;
    }
  }, []);

  const fetchFavorites = useCallback(async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/user/getfavorites", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setFavorites(data.movies);
      else toast.error(data.message);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      toast.error("Failed to fetch favourites");
    }
  }, [getToken]);

  const bumpMovies = useCallback(() => setRefreshMoviesFlag(p => !p), []);
  const bumpFavorites = useCallback(() => setRefreshFavoritesFlag(p => !p), []);

  useEffect(() => {
    if (user) {
      fetchIsAdmin();
      fetchIsOwner();
    } else {
      setIsAdmin(false);
      setIsOwner(false);
    }
  }, [user]); // eslint-disable-line

  useEffect(() => { fetchShows(); }, [fetchShows, refreshMoviesFlag]);

  useEffect(() => {
    if (user && (location.pathname === "/favourites" || refreshFavoritesFlag)) {
      fetchFavorites();
    }
  }, [user, location.pathname, refreshFavoritesFlag, fetchFavorites]);

  return (
    <AppContext.Provider
      value={{
        // data
        shows,
        favorites,
        isAdmin,
        isOwner,
        checkingAdmin,
        checkingOwner,

        // api
        fetchIsAdmin,
        fetchIsOwner,
        fetchFavorites,
        getToken,
        axios,

        // user
        user,

        // triggers
        bumpMovies,
        bumpFavorites,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
