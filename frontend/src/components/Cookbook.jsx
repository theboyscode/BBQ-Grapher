import { useState, useEffect } from 'react';
import { Calendar, Clock, Target, ThermometerSun, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import BBQChart from './BBQChart';

const Cookbook = () => {
  const [sessions, setSessions] = useState([]);
  const [expandedSession, setExpandedSession] = useState(null);
  const [sessionData, setSessionData] = useState({});

  useEffect(() => {
    fetch('/api/sessions')
      .then(res => res.json())
      .then(data => setSessions(data))
      .catch(err => console.error("Failed to load sessions", err));
  }, []);

  const toggleSession = async (session) => {
    if (expandedSession === session.id) {
      setExpandedSession(null);
      return;
    }
    
    setExpandedSession(session.id);
    
    if (!sessionData[session.id]) {
      try {
        const res = await fetch(`/api/sessions/${session.id}/history`);
        const data = await res.json();
        setSessionData(prev => ({ ...prev, [session.id]: data }));
      } catch (err) {
        console.error("Failed to load session history", err);
      }
    }
  };

  const calculateDuration = (start, end) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const hours = (endTime - startTime) / (1000 * 60 * 60);
    return hours.toFixed(1) + ' hrs';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-900/50 p-6 rounded-2xl shadow-2xl border border-gray-800">
        <h2 className="text-2xl font-bold text-gray-100 mb-6 flex items-center gap-2">
          <BookOpen className="text-orange-500" />
          The Cookbook
        </h2>
        
        {sessions.length === 0 ? (
          <div className="text-center text-gray-500 py-10">
            <p>No cook sessions recorded yet.</p>
            <p className="text-sm mt-2">Start a cook on the Dashboard to save it here!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map(session => (
              <div key={session.id} className="bg-gray-800/40 border border-gray-700/50 rounded-xl overflow-hidden transition-all duration-300">
                <button 
                  onClick={() => toggleSession(session)}
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex items-center gap-6">
                    <div>
                      <h3 className="text-lg font-bold text-orange-400">{session.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-400 mt-2">
                        <span className="flex items-center gap-1"><Calendar size={14}/> {new Date(session.start_time).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><Clock size={14}/> {calculateDuration(session.start_time, session.end_time)}</span>
                        <span className="flex items-center gap-1"><Target size={14}/> {session.target_temp}°F Target</span>
                        {!session.end_time && <span className="text-green-400 font-bold ml-2 animate-pulse">ACTIVE</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-gray-500">
                    {expandedSession === session.id ? <ChevronUp /> : <ChevronDown />}
                  </div>
                </button>
                
                {expandedSession === session.id && (
                  <div className="p-4 border-t border-gray-700/50 bg-gray-900/80">
                    {sessionData[session.id] ? (
                      <div className="h-96">
                        <BBQChart data={sessionData[session.id]} targetTemp={session.target_temp} />
                      </div>
                    ) : (
                      <div className="h-96 flex items-center justify-center text-gray-500 animate-pulse">
                        Loading graph...
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Cookbook;
