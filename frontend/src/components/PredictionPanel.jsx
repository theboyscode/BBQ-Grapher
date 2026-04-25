import { useMemo } from 'react';
import { Timer, Target, Flame, Thermometer } from 'lucide-react';

const PredictionPanel = ({ data, targetTemp, setTargetTemp, currentMeatTemp, currentSmokerTemp, currentProbe3, currentProbe4 }) => {
  
  const estimatedTimeRemaining = useMemo(() => {
    if (!targetTemp || !data || data.length < 2 || !currentMeatTemp || !currentSmokerTemp) return null;
    
    // Use the last 30 minutes of data to find the heating curve
    const thirtyMinsAgo = new Date(data[data.length - 1].timestamp.replace(' ', 'T') + 'Z').getTime() - 30 * 60 * 1000;
    const recentData = data.filter(d => new Date(d.timestamp.replace(' ', 'T') + 'Z').getTime() > thirtyMinsAgo);
    
    if (recentData.length < 5) return null; // Not enough data points

    // Find the average smoker temp over this period to use as environmental temp
    const avgSmokerTemp = recentData.reduce((sum, d) => sum + d.smokerTemp, 0) / recentData.length;

    if (targetTemp >= avgSmokerTemp) return 'Target ≥ Smoker';
    if (currentMeatTemp >= targetTemp) return 'Done!';

    // Newton's Law of Heating: T(t) = T_env - (T_env - T_initial) * e^(-kt)
    // We linearize this to find k: ln(T_env - T(t)) = -k * t + b
    // y = ln(avgSmokerTemp - meatTemp), x = time in minutes
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    let validPoints = 0;
    
    const startTime = new Date(recentData[0].timestamp.replace(' ', 'T') + 'Z').getTime();

    recentData.forEach(d => {
      // Ensure meat temp is lower than average smoker temp to avoid ln(negative)
      if (avgSmokerTemp > d.meatTemp) {
        const x = (new Date(d.timestamp.replace(' ', 'T') + 'Z').getTime() - startTime) / (1000 * 60); // minutes
        const y = Math.log(avgSmokerTemp - d.meatTemp);
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
        validPoints++;
      }
    });

    if (validPoints < 5) return 'Calculating...';

    // Calculate slope m = -k
    const m = (validPoints * sumXY - sumX * sumY) / (validPoints * sumX2 - sumX * sumX);
    const k = -m;
    
    // Check for "The Stall"
    // Usually happens between 150°F and 175°F. 
    // If the smoker is hot but k is extremely low or negative, it's evaporating!
    if (currentMeatTemp >= 150 && currentMeatTemp <= 175 && avgSmokerTemp > 200 && k <= 0.0005) {
      return 'IN THE STALL';
    }

    // If k <= 0 and we aren't in the stall, it's just cooling down
    if (k <= 0) return 'Cooling down';

    // Calculate remaining time
    // t_remaining = ln((T_env - T_current) / (T_env - T_target)) / k
    const tempRatio = (avgSmokerTemp - currentMeatTemp) / (avgSmokerTemp - targetTemp);
    
    if (tempRatio <= 0) return 'Error';

    const minsRemaining = Math.log(tempRatio) / k;
    
    if (minsRemaining > 24 * 60) return '> 24 hrs'; // Unreasonable
    if (minsRemaining < 0) return 'Done!';
    
    const hrs = Math.floor(minsRemaining / 60);
    const mins = Math.floor(minsRemaining % 60);

    return `${hrs}h ${mins}m`;
  }, [data, targetTemp, currentMeatTemp, currentSmokerTemp]);

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      
      {/* Current Meat Temp */}
      <div className="flex-1 min-w-[200px] bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center shadow-lg">
        <div className="p-3 bg-red-900/30 rounded-lg mr-4">
          <Thermometer className="text-red-400" size={28} />
        </div>
        <div>
          <p className="text-gray-400 text-sm font-medium">Meat Temp</p>
          <p className="text-3xl font-bold text-white">
            {currentMeatTemp ? `${currentMeatTemp.toFixed(1)}°` : '--'}
          </p>
        </div>
      </div>

      {/* Current Smoker Temp */}
      <div className="flex-1 min-w-[200px] bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center shadow-lg">
        <div className="p-3 bg-blue-900/30 rounded-lg mr-4">
          <Flame className="text-blue-400" size={28} />
        </div>
        <div>
          <p className="text-gray-400 text-sm font-medium">Smoker Temp</p>
          <p className="text-3xl font-bold text-white">
            {currentSmokerTemp ? `${currentSmokerTemp.toFixed(1)}°` : '--'}
          </p>
        </div>
      </div>

      {/* Probe 3 (Optional) */}
      {currentProbe3 > 0 && (
        <div className="flex-1 min-w-[200px] bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center shadow-lg">
          <div className="p-3 bg-orange-900/30 rounded-lg mr-4">
            <Thermometer className="text-orange-400" size={28} />
          </div>
          <div>
            <p className="text-gray-400 text-sm font-medium">Probe 3</p>
            <p className="text-3xl font-bold text-white">
              {currentProbe3.toFixed(1)}°
            </p>
          </div>
        </div>
      )}

      {/* Probe 4 (Optional) */}
      {currentProbe4 > 0 && (
        <div className="flex-1 min-w-[200px] bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center shadow-lg">
          <div className="p-3 bg-pink-900/30 rounded-lg mr-4">
            <Thermometer className="text-pink-400" size={28} />
          </div>
          <div>
            <p className="text-gray-400 text-sm font-medium">Probe 4</p>
            <p className="text-3xl font-bold text-white">
              {currentProbe4.toFixed(1)}°
            </p>
          </div>
        </div>
      )}

      {/* Target Settings */}
      <div className="flex-1 min-w-[200px] bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center shadow-lg">
        <div className="p-3 bg-teal-900/30 rounded-lg mr-4">
          <Target className="text-teal-400" size={28} />
        </div>
        <div className="flex-1">
          <p className="text-gray-400 text-sm font-medium">Target Temp</p>
          <div className="flex items-center mt-1">
            <input 
              type="number" 
              value={targetTemp}
              onChange={(e) => setTargetTemp(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xl font-bold focus:outline-none focus:border-teal-500"
            />
            <span className="ml-2 text-gray-400 font-bold">°F</span>
          </div>
        </div>
      </div>

      {/* ETA */}
      <div className="flex-1 min-w-[200px] bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center shadow-lg">
        <div className="p-3 bg-purple-900/30 rounded-lg mr-4">
          <Timer className="text-purple-400" size={28} />
        </div>
        <div>
          <p className="text-gray-400 text-sm font-medium">Estimated Time</p>
          <p className="text-3xl font-bold text-purple-100">
            {estimatedTimeRemaining || '--'}
          </p>
        </div>
      </div>

    </div>
  );
};

export default PredictionPanel;
