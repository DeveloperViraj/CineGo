import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import Movie from './models/Movie.js';
import Show from './models/Show.js';
import { dummyShowsData } from './dummyData.js';

dotenv.config();
const MONGO_URI = process.env.MONGO_URI;

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  }
};

const seedData = async () => {
  try {
    // Clear previous documents
    await Movie.deleteMany({});
    await Show.deleteMany({});
    console.log('🧹 Cleared old movie & show documents');

    // Remove duplicate movies
    const uniqueMovies = Array.from(
      new Map(dummyShowsData.map((m) => [m._id, m])).values()
    );

    // Convert _id to ObjectId and store map
    const movieIdMap = new Map(); // to use in Show creation

    const insertedMovies = await Movie.insertMany(
      uniqueMovies.map((movie) => {
        const objectId = new Types.ObjectId();
        movieIdMap.set(movie._id, objectId);
        return {
          _id: objectId,
          originalTitle: movie.title,
          description: movie.overview,
          primaryImage: movie.poster_path,
          thumbnails: [movie.backdrop_path],
          trailer: '',
          releaseDate: movie.release_date,
          original_language: [movie.original_language],
          genres: movie.genres.map((g) => g.name),
          casts: movie.casts.map((c) => c.name),
          averageRating: movie.vote_average,
          runtime: movie.runtime,
          numVotes: movie.vote_count,
        };
      })
    );

    // Create show docs referencing correct ObjectId
    const showDocs = insertedMovies.map((movie) => ({
      movie: movie._id,
      showDateTime: new Date(Date.now() + 60 * 60 * 1000),
      showprice: 200,
    }));

    await Show.insertMany(showDocs);
    console.log('✅ Dummy shows inserted!');
    console.log('✅ Movies & Shows seeded!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
};

await connectDB();
await seedData();
