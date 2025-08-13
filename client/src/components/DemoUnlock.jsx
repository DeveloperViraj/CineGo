import { useState } from "react";
import { useAppContext } from "../context/Appcontext.jsx";
import { useAuth } from "@clerk/clerk-react";

export default function DemoUnlock() {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const { axios, fetchIsAdmin } = useAppContext();
  const { getToken } = useAuth();

  const onUnlock = async () => {
    try {
      const token = await getToken();
      const { data } = await axios.post("/api/admin/demo-elevate", { code }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMsg(data.message || "Enabled.");
      await fetchIsAdmin();
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed");
    }
  };

  return (
    <div className="p-4 rounded-xl border border-gray-300/70 bg-white/10 backdrop-blur">
      <p className="font-medium mb-2">Admin demo (private)</p>
      <p className="text-xs text-gray-400 mb-3">
        Enter <b>letmein123</b> to preview admin. Your changes are only visible to you.
      </p>
      <div className="flex gap-2">
        <input className="border px-3 py-2 rounded w-64 bg-transparent"
               placeholder="Enter demo code"
               value={code} onChange={e=>setCode(e.target.value)} />
        <button onClick={onUnlock} className="px-4 py-2 rounded bg-black text-white">
          Unlock
        </button>
      </div>
      {msg && <p className="text-sm mt-2">{msg}</p>}
    </div>
  );
}
