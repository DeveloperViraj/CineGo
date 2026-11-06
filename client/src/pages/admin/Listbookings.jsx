import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Loading from '../../components/Loading';
import Title from '../../components/Title';
import BlurCircle from '../../components/BlurCircle';
import { useAppContext } from '../../context/Appcontext';
import { CURRENCY, formatDateTime } from '../../lib/format';

const Listbookings = () => {
  const { axios, authHeaders } = useAppContext();
  const [bookings, setBookings] = useState(null);

  const fetchbookings = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/admin/getallbookings', { headers: await authHeaders() });
      if (!data.success) throw new Error(data.message);
      setBookings(data.bookings || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Something went wrong');
      setBookings([]);
    }
  }, [axios, authHeaders]);

  useEffect(() => {
    fetchbookings();
  }, [fetchbookings]);

  if (bookings === null) return <Loading />;

  return (
    <div className="relative mx-auto w-full max-w-7xl md:px-4">
      <Title text1="List" text2="Bookings" />
      <BlurCircle top="0" left="0" />
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full table-auto border-collapse overflow-hidden rounded-lg text-sm text-white max-md:text-xs">
          <thead>
            <tr className="whitespace-nowrap bg-primary/20 text-left">
              <th className="p-3 font-semibold">Customer</th>
              <th className="p-3 font-semibold">Movie</th>
              <th className="p-3 font-semibold">Show time</th>
              <th className="p-3 font-semibold">Seats</th>
              <th className="p-3 font-semibold">Amount</th>
              <th className="p-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="font-light">
            {bookings.map((b) => (
              <tr key={b._id} className="whitespace-nowrap border-b border-primary/10 bg-primary/5 even:bg-primary/10">
                <td className="max-w-[180px] truncate p-3">{b.user?.name || 'N/A'}</td>
                <td className="max-w-[180px] truncate p-3">{b.show?.movie?.originalTitle || 'N/A'}</td>
                <td className="p-3">{b.show?.showDateTime ? formatDateTime(b.show.showDateTime) : '--'}</td>
                <td className="p-3">{(b.bookedseats || []).join(', ')}</td>
                <td className="p-3">{CURRENCY}{b.amount ?? 0}</td>
                <td className="p-3 text-xs">
                  {b.isPaid ? (
                    <span className="rounded-full bg-green-600/20 px-2 py-0.5 text-green-400">Paid</span>
                  ) : (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300">Pending</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bookings.length === 0 && <p className="py-8 text-center text-gray-400">No bookings yet.</p>}
      </div>
    </div>
  );
};

export default Listbookings;
