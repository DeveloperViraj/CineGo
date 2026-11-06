import { useCallback, useEffect, useState } from 'react';
import { BotIcon, Loader2Icon, RefreshCwIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/Appcontext';

const ago = (date) => {
  if (!date) return 'never';
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
};

// Shows what the automatic now-playing scheduler is doing, with a "run now" button.
const AutoSchedulePanel = ({ onSynced }) => {
  const { axios, authHeaders, isDemo } = useAppContext();
  const [status, setStatus] = useState(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/admin/schedule-status', { headers: await authHeaders() });
      if (data.success) setStatus(data.status);
    } catch {
      /* panel is informational */
    }
  }, [axios, authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const runNow = async () => {
    setRunning(true);
    try {
      const { data } = await axios.post('/api/admin/sync-shows', {}, { headers: await authHeaders(), timeout: 60000 });
      if (!data.success) throw new Error(data.message);
      const r = data.result || {};
      if (r.skipped) toast(`Skipped: ${r.skipped}`);
      else toast.success(`Synced ${r.movies} movies · ${r.showsCreated} new shows`);
      await load();
      onSynced?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Sync failed');
    } finally {
      setRunning(false);
    }
  };

  if (!status) return null;
  const r = status.lastResult;
  const healthy = status.enabled && status.lastSuccessAt && Date.now() - new Date(status.lastSuccessAt) < 36 * 3600 * 1000;

  return (
    <div className="mt-6 rounded-xl border border-primary/25 bg-primary/10 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <BotIcon className="mt-0.5 h-6 w-6 shrink-0 text-primary-dull" />
          <div>
            <p className="font-semibold">
              Automatic schedule{' '}
              <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${healthy ? 'bg-green-600/20 text-green-400' : 'bg-amber-500/20 text-amber-300'}`}>
                {!status.enabled ? 'off' : healthy ? 'active' : 'waiting for first run'}
              </span>
            </p>
            <p className="mt-1 text-sm text-gray-300">
              Every day the top {status.movieCount} movies playing in cinemas{status.region ? ` (${status.region})` : ''} are
              scheduled {status.days} days ahead at {status.slots.join(', ')}. No manual updates needed.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Last run {ago(status.lastSuccessAt)}
              {r && !r.skipped ? ` · ${r.movies} movies · ${r.showsCreated} new shows · source: ${r.source}` : ''}
              {!status.tmdbConfigured ? ' · TMDB key missing (using known movies)' : ''}
            </p>
            {status.lastError && <p className="mt-1 text-xs text-red-400">Last error: {status.lastError}</p>}
          </div>
        </div>
        {!isDemo && (
          <button
            onClick={runNow}
            disabled={running}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium hover:bg-primary-dull disabled:opacity-50"
          >
            {running ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <RefreshCwIcon className="h-4 w-4" />}
            {running ? 'Syncing…' : 'Sync now'}
          </button>
        )}
      </div>
    </div>
  );
};

export default AutoSchedulePanel;
