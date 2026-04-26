import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Battery, LayoutDashboard, BookOpen, Play, Square } from 'lucide-react';
import BBQChart from './components/BBQChart';
import PredictionPanel from './components/PredictionPanel';
import Cookbook from './components/Cookbook';

// Connect to the backend using a relative path, as Nginx will proxy /socket.io/ for us!
const socket = io();

function App() {
  const [data, setData] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [targetTemp, setTargetTemp] = useState(205);
  const [zipCode, setZipCode] = useState('');
  const [currentMeatTemp, setCurrentMeatTemp] = useState(null);
  const [currentSmokerTemp, setCurrentSmokerTemp] = useState(null);
  const [currentProbe3, setCurrentProbe3] = useState(null);
  const [currentProbe4, setCurrentProbe4] = useState(null);
  const [battery, setBattery] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Real-time connection states
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [lastDataTime, setLastDataTime] = useState(Date.now());
  const [isReceiving, setIsReceiving] = useState(false);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to backend WebSocket');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from backend WebSocket');
      setIsConnected(false);
      setIsReceiving(false);
    });

    socket.on('history', (historicalData) => {
      setData(historicalData);
      if (historicalData.length > 0) {
        const last = historicalData[historicalData.length - 1];
        setCurrentMeatTemp(last.meatTemp);
        setCurrentSmokerTemp(last.smokerTemp);
        setCurrentProbe3(last.probe3);
        setCurrentProbe4(last.probe4);
        setBattery(last.battery);
        setLastDataTime(Date.now());
        setIsReceiving(true);
      }
    });

    socket.on('activeSession', (session) => {
      setActiveSession(session);
      if (session && session.target_temp) {
        setTargetTemp(session.target_temp);
      }
      if (session && session.zip_code) {
        setZipCode(session.zip_code);
      }
    });

    socket.on('targetTempChanged', ({ temp }) => {
      setTargetTemp(temp);
    });

    socket.on('notificationsChanged', ({ enabled }) => {
      setActiveSession(prev => prev ? { ...prev, notifications_enabled: enabled } : prev);
    });

    socket.on('zipCodeChanged', ({ zipCode }) => {
      setZipCode(zipCode);
      setActiveSession(prev => prev ? { ...prev, zip_code: zipCode } : prev);
    });

    socket.on('temperatureUpdate', (newDataPoint) => {
      setData(prev => [...prev, newDataPoint]);
      setCurrentMeatTemp(newDataPoint.meatTemp);
      setCurrentSmokerTemp(newDataPoint.smokerTemp);
      setCurrentProbe3(newDataPoint.probe3);
      setCurrentProbe4(newDataPoint.probe4);
      setBattery(newDataPoint.battery);
      setLastDataTime(Date.now());
      setIsReceiving(true);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('history');
      socket.off('temperatureUpdate');
      socket.off('activeSession');
      socket.off('targetTempChanged');
      socket.off('notificationsChanged');
      socket.off('zipCodeChanged');
    };
  }, []);

  const handleStartCook = async () => {
    const name = prompt("Enter a name for this cook session:", "Brisket");
    if (!name) return;
    const initialZip = prompt("Enter your ZIP code for weather data (optional):", zipCode || "");
    await fetch('/api/sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, zipCode: initialZip || "" })
    });
  };

  const handleEndCook = async () => {
    if (confirm("Are you sure you want to end the current cook session?")) {
      await fetch('/api/sessions/end', { method: 'POST' });
    }
  };

  const handleTargetTempChange = async (newTemp) => {
    setTargetTemp(newTemp);
    if (activeSession) {
      await fetch('/api/sessions/target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSession.id, temp: newTemp })
      });
    }
  };

  // Monitor staleness (If no data for 20 seconds, we aren't receiving live data)
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastDataTime > 20000) {
        setIsReceiving(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lastDataTime]);

  return (
    <div className="min-h-screen bg-[#0f1115] text-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
              BBQ Grapher Pro
            </h1>
            <p className="text-gray-400 mt-1">Smart predictive monitoring</p>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2 bg-gray-800/50 p-1 rounded-lg border border-gray-700/50 mr-4">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
              >
                <LayoutDashboard size={16} /> Dashboard
              </button>
              <button 
                onClick={() => setActiveTab('cookbook')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'cookbook' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
              >
                <BookOpen size={16} /> Cookbook
              </button>
            </nav>

            {battery !== null && (
              <div className="flex items-center gap-1 text-gray-400 bg-gray-800/50 px-2 py-1.5 rounded-md border border-gray-700/50">
                <Battery size={16} className={battery > 20 ? "text-green-400" : "text-red-400"} />
                <span className="text-xs font-bold">{battery.toFixed(0)}%</span>
              </div>
            )}
            
            <div className="flex items-center gap-2 bg-gray-800/50 px-3 py-1.5 rounded-md border border-gray-700/50">
              {!isConnected ? (
              <>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                <span className="text-sm text-red-400 font-medium tracking-wide">DISCONNECTED</span>
              </>
            ) : !isReceiving ? (
              <>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                <span className="text-sm text-yellow-400 font-medium tracking-wide">WAITING FOR PROBES</span>
              </>
            ) : (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="text-sm text-green-400 font-medium tracking-wide">LIVE</span>
              </>
            )}
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' ? (
          <>
            {!activeSession && (
              <div className="mb-6 bg-blue-900/40 border border-blue-500/50 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="text-blue-100 font-bold text-lg">Not Recording</h3>
                  <p className="text-blue-300 text-sm">You are viewing live data, but it is not being saved to the database. Start a cook session to record history.</p>
                </div>
                <button 
                  onClick={handleStartCook}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-lg"
                >
                  <Play size={18} fill="currentColor" /> Start Cook
                </button>
              </div>
            )}

            {activeSession && (
              <div className="mb-6 bg-orange-900/40 border border-orange-500/50 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="text-orange-100 font-bold text-lg flex items-center gap-2">
                    Active Cook: {activeSession.name}
                    <button
                      onClick={async () => {
                        const newState = !activeSession.notifications_enabled;
                        setActiveSession(prev => ({ ...prev, notifications_enabled: newState }));
                        await fetch('/api/sessions/notifications', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ sessionId: activeSession.id, enabled: newState })
                        });
                      }}
                      className={`ml-2 px-2 py-1 text-xs rounded border transition-colors ${activeSession.notifications_enabled ? 'bg-green-500/20 text-green-300 border-green-500/50' : 'bg-gray-500/20 text-gray-400 border-gray-500/50'}`}
                    >
                      {activeSession.notifications_enabled ? '🔔 SMS ON' : '🔕 SMS OFF'}
                    </button>
                  </h3>
                  <p className="text-orange-300 text-sm mt-1">Recording data to the Cookbook since {new Date(activeSession.start_time).toLocaleTimeString()}</p>
                  <div className="flex items-center mt-2">
                    <label className="text-orange-200 text-xs mr-2 font-semibold">ZIP Code:</label>
                    <input 
                      type="text" 
                      value={zipCode} 
                      onChange={(e) => setZipCode(e.target.value)}
                      onBlur={async () => {
                        if (activeSession) {
                          await fetch('/api/sessions/zip', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId: activeSession.id, zipCode })
                          });
                        }
                      }}
                      className="bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600 w-24 focus:outline-none focus:border-orange-500"
                      placeholder="e.g. 78701"
                    />
                  </div>
                </div>
                <button 
                  onClick={handleEndCook}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-lg"
                >
                  <Square size={18} fill="currentColor" /> End Cook
                </button>
              </div>
            )}

            <PredictionPanel 
              data={data}
              targetTemp={targetTemp}
              setTargetTemp={handleTargetTempChange}
              currentMeatTemp={currentMeatTemp}
              currentSmokerTemp={currentSmokerTemp}
              currentProbe3={currentProbe3}
              currentProbe4={currentProbe4}
            />

            <div className="bg-gray-900/50 p-1 rounded-2xl shadow-2xl border border-gray-800">
              <BBQChart data={data} targetTemp={targetTemp} />
            </div>
          </>
        ) : (
          <Cookbook />
        )}

        <div className="mt-4 flex justify-between text-xs text-gray-500 px-2">
          <p>Tip: Hover directly over the time or temperature axis numbers to scale/shift them independently!</p>
          <p>Secure WebSocket Connection Active</p>
        </div>
      </div>
    </div>
  );
}

export default App;
