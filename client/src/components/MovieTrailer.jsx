import React, { useEffect, useState } from 'react';
import BlurCircle from './BlurCircle';
import { PlayCircleIcon } from 'lucide-react';
import axios from 'axios';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY; // 🧠 Must be in .env

const MovieTrailer = () => {
  const [trailers, setTrailers] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);

  const fetchTrailers = async () => {
    try {
      // Step 1: Get popular movies
      const { data: popularData } = await axios.get(
        `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`
      );

      const movies = popularData.results.slice(0, 6); // Limit to top 6 movies

      // Step 2: Fetch trailers for each movie
      const trailersData = await Promise.all(
        movies.map(async (movie) => {
          const { data: videoData } = await axios.get(
            `https://api.themoviedb.org/3/movie/${movie.id}/videos?api_key=${TMDB_API_KEY}&language=en-US`
          );

          const youtubeTrailer = videoData.results.find(
            (vid) => vid.site === 'YouTube' && vid.type === 'Trailer'
          );

          if (youtubeTrailer) {
            return {
              id: movie.id,
              title: movie.title,
              thumbnail: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
              videoUrl: `https://www.youtube.com/embed/${youtubeTrailer.key}`
            };
          }

          return null;
        })
      );

      const filteredTrailers = trailersData.filter(Boolean);
      setTrailers(filteredTrailers);
      setCurrentVideo(filteredTrailers[0]);
    } catch (err) {
      console.error('Failed to load trailers:', err);
    }
  };

  useEffect(() => {
    fetchTrailers();
  }, []);

  return (
    <div className='px-4 sm:px-6 md:px-8 lg:px-16 xl:px-20 py-10 overflow-hidden'>
      <p className='text-gray-300 font-medium text-lg max-md:text-sm max-w-lg pl-6 sm:pl-0'>
        Trailers
      </p>

      <div className="relative mt-6">
        <BlurCircle top='0px' left='-100px' />
      </div>

      {currentVideo && (
        <div className="relative w-full max-w-6xl mx-auto mt-10">
          <div className="relative pt-[56.25%] w-full">
            <iframe
              src={currentVideo.videoUrl + "?rel=0"}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="absolute top-0 left-0 w-full h-full rounded-lg"
            />
          </div>
        </div>
      )}

      <div className="relative">
        <BlurCircle top='-150px' right='80px' />
      </div>

      <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-8 max-w-5xl mx-auto px-2'>
        {trailers.map((trailer, index) => (
          <div
            key={index}
            className='relative group transition-transform transform hover:-translate-y-1 cursor-pointer'
            onClick={() => setCurrentVideo(trailer)}
          >
            <img
              src={trailer.thumbnail}
              alt={trailer.title}
              className='rounded-lg w-full h-full object-cover brightness-75'
            />
            <PlayCircleIcon
              strokeWidth={1.6}
              className='absolute top-1/2 left-1/2 w-6 h-6 md:w-8 md:h-8 transform -translate-x-1/2 -translate-y-1/2 text-white'
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MovieTrailer;
