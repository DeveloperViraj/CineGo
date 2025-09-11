import { useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import BlurCircle from "../components/BlurCircle";
import MovieCard from "../components/MovieCard";
import { useAppContext } from "../context/Appcontext";
import { FlaskConical } from "lucide-react";

// very small "NL" parser → genres + keywords
const GENRE_WORDS = [
  "action","adventure","animation","comedy","crime","drama","family","fantasy",
  "history","horror","mystery","romance","sci-fi","science fiction","thriller","war","western"
];

function parseQuery(qRaw = "") {
  const q = qRaw.toLowerCase();
  const pickedGenres = new Set(
    GENRE_WORDS.filter((g) => q.includes(g))
      .map((g) => (g === "science fiction" ? "science fiction" : g))
  );

  // simple max-price pattern (kept for later, harmless if you don’t use it here)
  const priceMatch = q.match(/(?:under|below|<=?\s?)(\d{2,5})\s*(?:rs|₹|inr|rupees)?/i);
  const priceMax = priceMatch ? Number(priceMatch[1]) : null;

  // free-text terms (strip very common stopwords)
  const stop = new Set(["movie","movies","this","on","at","after","before","near","under","below","rs","inr","₹","the"]);
  const textTerms = q
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !stop.has(w) && !GENRE_WORDS.includes(w))
    .slice(0, 5); // keep it tiny

  return { genres: [...pickedGenres], priceMax, textTerms };
}

function filterShows(shows = [], q) {
  const { genres, textTerms } = parseQuery(q);

  return shows.filter((m) => {
    const title = (m.originalTitle || "").toLowerCase();
    const desc = (m.description || "").toLowerCase();
    const movieGenres = (m.genres || []).map((g) => g.toLowerCase());

    // genre match: if user asked for some genres, require at least one
    const genreOK = genres.length
      ? genres.some((g) => movieGenres.includes(g))
        || (genres.includes("sci-fi") && movieGenres.includes("science fiction"))
      : true;

    // text terms: all provided terms should appear somewhere in title/desc
    const textOK = textTerms.length
      ? textTerms.every((t) => title.includes(t) || desc.includes(t))
      : true;

    return genreOK && textOK;
  });
}

const Movies = () => {
  const { shows, isAdmin } = useAppContext();
  const [params] = useSearchParams();
  const query = params.get("query") || "";

  const list = useMemo(
    () => (query ? filterShows(shows, query) : shows),
    [shows, query]
  );

  return (
    <div className="relative px-6 md:px-8 lg:px-16 xl:px-20 overflow-hidden py-10 max-md:py-0">
      <div className="relative flex items-center justify-between pt-20 pb-5 pl-10 text-lg max-md:pl-0">
        <BlurCircle top="80px" right="-40px" />
        <p className="text-gray-300 font-medium max-md:text-md text-lg">
          {query ? `Results for “${query}”` : "Now Showing"}
        </p>
        <BlurCircle top="500px" left="0px" />
      </div>

      {list.length === 0 ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center text-center text-gray-300 gap-4">
          <p className="text-lg">
            No movies found.
          </p>

          <p className="max-w-xl text-sm text-gray-400">
            No movies Available, Try adding movies from the Admin panel by clicking the <span className="inline-flex items-center justify-center mx-1">
              <FlaskConical className="w-5 h-5 inline-block" />
            </span> icon.
          </p>

          <div className="flex gap-3 mt-2">
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dull rounded-full text-sm font-medium"
            >
              <FlaskConical className="w-4 h-4" />
              Open Admin
            </Link>

            {/* Helpful alternative if not admin: open demo (keeps previous demo flow) */}
            {!isAdmin && (
              <Link
                to="/demo"
                className="inline-flex items-center gap-2 px-4 py-2 border border-white/10 rounded-full text-sm font-medium"
              >
                Try Admin Demo
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-8 mt-8">
          {list.filter(Boolean).map((movie) =>
            movie._id ? <MovieCard key={movie._id} movie={movie} /> : null
          )}
        </div>
      )}
    </div>
  );
};

export default Movies;
