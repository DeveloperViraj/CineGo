import { ChartLineIcon, IndianRupeeIcon, PlayCircleIcon, StarIcon, UsersIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import Loading from '../../components/Loading';
import Title from '../../components/Title';
import BlurCircle from '../../components/BlurCircle';
import AutoSchedulePanel from '../../components/AutoSchedulePanel';
import { useAppContext } from '../../context/Appcontext';
import { tmdbImage } from '../../lib/api';
import { CURRENCY, formatNextShow } from '../../lib/format';

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [failed, setFailed] = useState(false);
  const { axios, authHeaders } = useAppContext();

  const fetchDashboardData = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/admin/dashboarddata', { headers: await authHeaders() });
      if (data.success) setDashboardData(data.dashboarddata);
      else throw new Error(data.message);
    } catch (error) {
      setFailed(true);
      toast.error(error?.response?.data?.message || error.message || 'Failed to load dashboard');
    }
  }, [axios, authHeaders]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (failed && !dashboardData) {
    return <p className="mt-10 text-center text-gray-400">Could not load the dashboard. Please refresh.</p>;
  }
  if (!dashboardData) return <Loading />;

  const cards = [
    { title: 'Paid bookings', value: dashboardData.totalBookings, icon: ChartLineIcon },
    { title: 'Revenue', value: `${CURRENCY}${(dashboardData.totalRevenue || 0).toLocaleString('en-IN')}`, icon: IndianRupeeIcon },
    { title: 'Upcoming shows', value: dashboardData.activeShowCount ?? dashboardData.activeshows.length, icon: PlayCircleIcon },
    { title: 'Users', value: dashboardData.totalUsers, icon: UsersIcon },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Title text1="Admin" text2="Dashboard" />
      <div className="relative">
        <BlurCircle top="0" left="0" />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.title} className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-4 py-4">
            <div>
              <p className="text-sm text-gray-300">{c.title}</p>
              <p className="pt-1 text-2xl font-semibold max-md:text-xl">{c.value}</p>
            </div>
            <c.icon className="h-7 w-7 text-primary-dull" />
          </div>
        ))}
      </div>

      <AutoSchedulePanel onSynced={fetchDashboardData} />

      <p className="mt-10 text-xl font-semibold">Now showing</p>
      <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {dashboardData.activeshows.length > 0 ? (
          dashboardData.activeshows
            .filter((s) => s?.movie?.originalTitle)
            .map((s) => (
              <div key={`${s._id}-${s.isDemo ? 'demo' : 'live'}`} className="overflow-hidden rounded-xl border border-primary/20 bg-primary/10">
                <img src={tmdbImage(s.movie.primaryImage, 'w342')} alt="" loading="lazy" className="aspect-[2/3] w-full object-cover" />
                <div className="p-3">
                  <p className="truncate font-semibold" title={s.movie.originalTitle}>
                    {s.movie.originalTitle}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span>
                      from {CURRENCY}
                      {s.showprice}
                    </span>
                    <span className="flex items-center gap-1 text-gray-300">
                      <StarIcon className="h-3.5 w-3.5 fill-primary text-primary" />
                      {Number(s.movie.averageRating || 0).toFixed(1)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {s.showCount} show{s.showCount === 1 ? '' : 's'} · next {formatNextShow(s.showDateTime)}
                  </p>
                  {s.isDemo && <p className="mt-1 text-xs text-amber-300">Demo (only you)</p>}
                </div>
              </div>
            ))
        ) : (
          <p className="text-gray-400">No upcoming shows yet — press “Sync now” above.</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
