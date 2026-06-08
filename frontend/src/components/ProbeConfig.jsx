import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';

const ProbeConfig = ({ activeSession }) => {
  const [probes, setProbes] = useState({
    p1: 'meat_primary',
    p2: 'smoker_primary',
    p3: 'none',
    p4: 'none'
  });
  const [interval, setIntervalVal] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(null);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState(null);

  useEffect(() => {
    fetch('/api/settings/probes')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setProbes({
            p1: data.probe1_role,
            p2: data.probe2_role,
            p3: data.probe3_role,
            p4: data.probe4_role
          });
          setIntervalVal(data.update_interval || 0);
        }
      });
    if (activeSession && activeSession.update_interval !== undefined) {
      setIntervalVal(activeSession.update_interval);
    }
  }, [activeSession]);

  const handleSave = async () => {
    if (activeSession) {
      await fetch('/api/sessions/interval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSession.id, interval: Number(interval) })
      });
      setIsOpen(false);
      return;
    }

    // Validate
    const values = Object.values(probes);
    const meatCount = values.filter(v => v === 'meat_primary').length;
    const smokerCount = values.filter(v => v === 'smoker_primary').length;
    if (meatCount !== 1 || smokerCount !== 1) {
      setError("You must have exactly one 'Meat (Primary)' and one 'Smoker (Primary)'.");
      return;
    }
    setError(null);
    await fetch('/api/settings/probes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...probes, interval: Number(interval) })
    });
    setIsOpen(false);
  };

  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    setTestEmailResult(null);
    try {
      const res = await fetch('/api/settings/test-email', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setTestEmailResult({ success: true, message: "Test email sent successfully!" });
      } else {
        setTestEmailResult({ success: false, message: data.error || "Failed to send email." });
      }
    } catch (err) {
      setTestEmailResult({ success: false, message: "Network error sending test email." });
    }
    setIsTestingEmail(false);
  };

  const options = [
    { value: 'meat_primary', label: 'Meat (Primary)' },
    { value: 'meat_secondary', label: 'Meat (Secondary)' },
    { value: 'smoker_primary', label: 'Smoker (Primary)' },
    { value: 'smoker_secondary', label: 'Smoker (Secondary)' },
    { value: 'none', label: 'Unused' }
  ];

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-md border border-gray-700 transition-colors text-sm font-medium"
      >
        <Settings size={16} /> Probe Config
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-4">Probe Configuration</h2>
        
        {activeSession && (
          <div className="mb-4 bg-orange-900/40 text-orange-200 p-3 rounded text-sm border border-orange-500/50">
            A cook is active. Mappings are locked.
          </div>
        )}

        <div className="space-y-4">
          {['p1', 'p2', 'p3', 'p4'].map((p, idx) => (
            <div key={p} className="flex items-center justify-between">
              <label className="text-gray-300 text-sm font-medium">Port {idx + 1}</label>
              <select
                value={probes[p]}
                disabled={!!activeSession}
                onChange={(e) => setProbes({ ...probes, [p]: e.target.value })}
                className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-48 p-2.5 disabled:opacity-50"
              >
                {options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
          <div className="flex items-center justify-between pt-4 border-t border-gray-700">
            <label className="text-gray-300 text-sm font-medium">Email Update Interval (mins)</label>
            <input
              type="number"
              value={interval}
              onChange={(e) => setIntervalVal(e.target.value)}
              className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-48 p-2.5"
              placeholder="0 = Disabled"
            />
          </div>
          <div className="flex justify-end mt-2">
            <button
              onClick={handleTestEmail}
              disabled={isTestingEmail}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded disabled:opacity-50 transition-colors"
            >
              {isTestingEmail ? "Sending..." : "Send Test Email"}
            </button>
          </div>
          {testEmailResult && (
            <p className={`text-xs mt-1 text-right ${testEmailResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {testEmailResult.message}
            </p>
          )}
        </div>

        {error && <p className="text-red-400 text-sm mt-4 font-bold">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button 
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-orange-600 hover:bg-orange-500 text-white rounded-lg"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProbeConfig;
