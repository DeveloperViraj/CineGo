import { useEffect, useState } from 'react';
import { useAppContext } from '../../context/Appcontext';
import Title from '../../components/Title';
import BlurCircle from '../../components/BlurCircle';
import toast from 'react-hot-toast';

export default function AdminAccess() {
  const { axios, getToken, user, isOwner } = useAppContext();
  const [email, setEmail] = useState('');
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!isOwner) { setLoading(false); return; }  // no fetch for non-owners
      try {
        const { data } = await axios.get('/api/admin/admins', {
          headers: { Authorization: `Bearer ${await getToken()}` },
        });
        if (data.success) setAdmins(data.admins);
      } catch (e) {
        toast.error(e?.response?.data?.message || 'Not allowed');
      } finally {
        setLoading(false);
      }
    };
    if (user) load();
  }, [user, isOwner, axios, getToken]);

  if (!isOwner) {
    return (
      <div className="relative">
        <Title text1="Admin" text2="Access" />
        <BlurCircle top="0" left="0" />
        <div className="mt-6 max-w-xl rounded-xl border border-gray-700/60 overflow-hidden">
          <div className="p-4 backdrop-blur-sm bg-white/5 select-none pointer-events-none">
            <p className="text-sm text-gray-400">
              This section is <b>owner-only</b>. For demo reviewers, access is redacted.
            </p>
            <div className="mt-3 h-28 bg-gray-700/30 rounded animate-pulse" />
            <div className="mt-2 h-10 bg-gray-700/30 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full md:px-4 relative">
      <Title text1="Admin" text2="Access" />
      <BlurCircle top="0" left="0" />

      <div className="mt-6 max-w-lg space-y-3">
        <label className="text-sm font-medium">Grant admin by email</label>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="user@example.com"
            className="flex-1 bg-transparent border border-gray-600 rounded px-3 py-2 outline-none"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <button
            onClick={async () => {
              try {
                if (!email) return toast.error('Enter an email');
                const { data } = await axios.post('/api/admin/grant', { email }, {
                  headers: { Authorization: `Bearer ${await getToken()}` },
                });
                if (data.success) { toast.success('Granted'); setEmail(''); location.reload(); }
                else toast.error(data.message);
              } catch (e) { toast.error(e?.response?.data?.message || 'Failed'); }
            }}
            className="px-4 py-2 bg-primary rounded hover:bg-primary/90"
          >
            Make admin
          </button>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-2">Current admins</h3>
        {loading ? (
          <div>Loading…</div>
        ) : admins.length === 0 ? (
          <div className="text-gray-400">No admins yet.</div>
        ) : (
          <div className="space-y-2">
            {admins.map(a => (
              <div key={a.id} className="flex items-center justify-between border border-gray-700 rounded px-3 py-2">
                <div className="truncate">{a.name} — <span className="text-gray-400">{a.email}</span></div>
                <button
                  onClick={async () => {
                    try {
                      const { data } = await axios.post('/api/admin/revoke', { email: a.email }, {
                        headers: { Authorization: `Bearer ${await getToken()}` },
                      });
                      if (data.success) location.reload();
                      else toast.error(data.message);
                    } catch (e) { toast.error(e?.response?.data?.message || 'Failed'); }
                  }}
                  className="px-3 py-1 text-sm bg-red-600 rounded hover:bg-red-700"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
