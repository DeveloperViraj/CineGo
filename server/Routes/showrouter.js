import express from 'express';
import {
  getmovies,
  getmovie,
  getnowplayingMovies,
  addshow,
  searchShows,
} from '../Control/Showcontrol.js';
import { protectAdmin } from '../Middleware/Auth.js';

const router = express.Router();

// Public
router.get('/getmovies', getmovies);
router.get('/getmovie/:movieId', getmovie);
router.get('/search', searchShows); 

// Admin
router.get('/nowplaying', protectAdmin, getnowplayingMovies);
router.post('/add', protectAdmin, addshow);

export default router;
