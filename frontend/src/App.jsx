import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Battery } from 'lucide-react';
import BBQChart from './components/BBQChart';
import PredictionPanel from './components/PredictionPanel';

// Connect to the backend using a relative path, as Nginx will proxy /socket.io/ for us!
const socket = io();

function App() {
  const [data, setData] = useState([]);
  const [targetTemp, setTargetTemp] = useState(205); // Default brisket/pork butt target
  const [currentMeatTemp, setCurrentMeatTemp] = useState(null);
  const [currentSmokerTemp, setCurrentSmokerTemp] = useState(null);
  const [currentProbe3, setCurrentProbe3] = useState(null);
  const [currentProbe4, setCurrentProbe4] = useState(null);
  const [battery, setBattery] = useState(null);
  
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
        // We just got history, we are theoretically alive
        setLastDataTime(Date.now());
        setIsReceiving(true);
      }
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
    };
  }, []);

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
            {battery !== null && (
              <div className="flex items-center gap-1 text-gray-400 bg-gray-800/50 px-2 py-1 rounded-md border border-gray-700/50">
                <Battery size={16} className={battery > 20 ? "text-green-400" : "text-red-400"} />
                <span className="text-xs font-bold">{battery.toFixed(0)}%</span>
              </div>
            )}
            
            <div className="flex items-center gap-2">
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

          <PredictionPanel 
            data={data}
            targetTemp={targetTemp}
            setTargetTemp={setTargetTemp}
            currentMeatTemp={currentMeatTemp}
            currentSmokerTemp={currentSmokerTemp}
            currentProbe3={currentProbe3}
            currentProbe4={currentProbe4}
          />

        <div className="bg-gray-900/50 p-1 rounded-2xl shadow-2xl border border-gray-800">
          <BBQChart data={data} targetTemp={targetTemp} />
        </div>

        <div className="mt-4 flex justify-between text-xs text-gray-500 px-2">
          <p>Tip: Hover directly over the time or temperature axis numbers to scale/shift them independently!</p>
          <p>Secure WebSocket Connection Active</p>
        </div>
      </div>
    </div>
  );
}

export default App;
