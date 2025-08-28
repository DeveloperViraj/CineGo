import { useEffect, useState } from 'react';
import Title from '../../components/Title';
import Loading from '../../components/Loading';
import formatDateTime from '../../lib/DateCalculate';
import BlurCircle from '../../components/BlurCircle';
import { useAppContext } from '../../context/Appcontext';
import toast from 'react-hot-toast';

const Listshow = () => {
  const { axios, getToken, user } = useAppContext();
  const currency = import.meta.env.VITE_CURRENCY || '₹';
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Safely count taken seats regardless of the backing shape (Map/Object/Array/undefined)
  const countTaken = (occupiedSeats) => {
    if (!occupiedSeats) return 0;

    // If it smells like a Map (from Mongoose without lean)
    if (typeof occupiedSeats?.forEach === 'function' &&
        typeof occupiedSeats?.get === 'function') {
      let c = 0;
      occupiedSeats.forEach(v => { if (v) c++; });
      return c;
    }

    // If it’s a plain object from JSON
    if (typeof occupiedSeats === 'object' && !Array.isArray(occupiedSeats)) {
      return Object.values(occupiedSeats).filter(Boolean).length;
    }

    // If an array slipped through (defensive)
    if (Array.isArray(occupiedSeats)) {
      return occupiedSeats.filter(Boolean).length;
    }

    return 0;
  };

  const fetchshows = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const { data } = await axios.get('/api/admin/getallshows', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data?.success) {
        setShows(Array.isArray(data.showdata) ? data.showdata : []);
      } else {
        toast.error(data?.message || 'Failed to load shows');
        setShows([]);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load shows');
      setShows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchshows();
  }, [user]); // eslint-disable-line

  if (loading) return <Loading />;

  return (
    <>
      <div className="w-full md:px-4 max-md:px-0 relative">
        <Title text1="List" text2="Shows" />
        <BlurCircle top="0" left="0" />

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full table-auto border-collapse text-sm text-white rounded-lg overflow-hidden max-md:text-xs">
            <thead>
              <tr className="bg-primary/20 text-left whitespace-nowrap">
                <th className="p-3 text-base font-semibold min-w-[160px]">Movie Name</th>
                <th className="p-3 text-base font-semibold min-w-[160px]">Show Time</th>
                <th className="p-3 text-base font-semibold min-w-[140px]">Total Bookings</th>
                <th className="p-3 text-base font-semibold min-w-[120px]">Earnings</th>
              </tr>
            </thead>

            <tbody className="text-sm font-light">
              {(shows || [])
                .filter(s => s && s._id) // keep row even if movie failed to populate; we’ll fallback name
                .map((show, idx) => {
                  const title = show?.movie?.originalTitle || 'Untitled';
                  const when = show?.showDateTime
                    ? formatDateTime(show.showDateTime).replace('•', ' at')
                    : '--';
                  const taken = countTaken(show?.occupiedSeats);
                  const price = Number(show?.showprice || 0);
                  const earnings = taken * price;

                  return (
                    <tr
                      key={show._id || idx}
                      className="border-b border-primary/10 bg-primary/5 even:bg-primary/10 whitespace-nowrap"
                    >
                      <td className="p-3 max-w-[220px] truncate">{title}</td>
                      <td className="p-3 max-w-[220px] truncate">{when}</td>
                      <td className="p-3">{taken}</td>
                      <td className="p-3">
                        {currency} {earnings}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default Listshow;
