import { useState, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Maximize } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  zoomPlugin
);

const BBQChart = ({ data, targetTemp, predictionData }) => {
  const chartRef = useRef(null);
  const [zoomState, setZoomState] = useState(null);

  const handleZoomPan = ({ chart }) => {
    setZoomState({
      xMin: chart.scales.x.min,
      xMax: chart.scales.x.max,
      yMin: chart.scales.y.min,
      yMax: chart.scales.y.max,
    });
  };

  const resetZoom = () => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
      setZoomState(null);
    }
  };

  const chartData = {
    datasets: [
      {
        label: 'Meat Temp (°F)',
        data: data.map(d => ({ x: new Date(d.timestamp.replace(' ', 'T') + 'Z'), y: d.meatTemp })),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        tension: 0.3,
        pointRadius: 0,
        pointHitRadius: 10,
      },
      {
        label: 'Smoker Temp (°F)',
        data: data.map(d => ({ x: new Date(d.timestamp.replace(' ', 'T') + 'Z'), y: d.smokerTemp })),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        tension: 0.3,
        pointRadius: 0,
        pointHitRadius: 10,
      }
    ]
  };

  const hasProbe3 = data.some(d => d.probe3 > 0);
  const hasProbe4 = data.some(d => d.probe4 > 0);

  if (hasProbe3) {
    chartData.datasets.push({
      label: 'Probe 3 (°F)',
      data: data.map(d => ({ x: new Date(d.timestamp.replace(' ', 'T') + 'Z'), y: d.probe3 > 0 ? d.probe3 : null })),
      borderColor: 'rgb(255, 159, 64)',
      backgroundColor: 'rgba(255, 159, 64, 0.5)',
      tension: 0.3,
      pointRadius: 0,
      pointHitRadius: 10,
      spanGaps: true,
    });
  }

  if (hasProbe4) {
    chartData.datasets.push({
      label: 'Probe 4 (°F)',
      data: data.map(d => ({ x: new Date(d.timestamp.replace(' ', 'T') + 'Z'), y: d.probe4 > 0 ? d.probe4 : null })),
      borderColor: 'rgb(255, 99, 232)',
      backgroundColor: 'rgba(255, 99, 232, 0.5)',
      tension: 0.3,
      pointRadius: 0,
      pointHitRadius: 10,
      spanGaps: true,
    });
  }

  const hasAmbient = data.some(d => d.ambientTemp != null);
  if (hasAmbient) {
    chartData.datasets.push({
      label: 'Ambient Temp (°F)',
      data: data.map(d => ({ x: new Date(d.timestamp.replace(' ', 'T') + 'Z'), y: d.ambientTemp != null ? d.ambientTemp : null })),
      borderColor: 'rgb(148, 163, 184)',
      backgroundColor: 'rgba(148, 163, 184, 0.5)',
      tension: 0.3,
      pointRadius: 0,
      pointHitRadius: 10,
      borderDash: [5, 5],
      spanGaps: true,
    });
  }

  if (targetTemp && data.length > 0) {
    chartData.datasets.push({
      label: 'Target Temp',
      data: [
        { x: new Date(data[0].timestamp.replace(' ', 'T') + 'Z'), y: targetTemp },
        // Extend target line to cover prediction if available
        { x: predictionData ? new Date(predictionData[predictionData.length - 1].x) : new Date(data[data.length - 1].timestamp.replace(' ', 'T') + 'Z'), y: targetTemp }
      ],
      borderColor: 'rgb(75, 192, 192)',
      borderDash: [5, 5],
      pointRadius: 0,
      borderWidth: 2
    });
  }

  if (predictionData && predictionData.length > 0) {
    chartData.datasets.push({
      label: 'Predicted Path',
      data: predictionData,
      borderColor: 'rgb(168, 85, 247)', // Purple
      backgroundColor: 'rgba(168, 85, 247, 0.5)',
      borderDash: [5, 5],
      tension: 0.3,
      pointRadius: 0,
      pointHitRadius: 10,
    });
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'minute',
          displayFormats: {
            minute: 'HH:mm'
          }
        },
        title: {
          display: true,
          text: 'Time',
          color: '#ccc'
        },
        ticks: { color: '#ccc' },
        grid: { color: '#333' },
        min: zoomState?.xMin,
        max: zoomState?.xMax,
      },
      y: {
        title: {
          display: true,
          text: 'Temperature (°F)',
          color: '#ccc'
        },
        ticks: { color: '#ccc' },
        grid: { color: '#333' },
        min: zoomState?.yMin,
        max: zoomState?.yMax,
      }
    },
    plugins: {
      legend: {
        labels: { color: '#ccc' }
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'xy',
          onPanComplete: handleZoomPan
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true
          },
          mode: 'xy',
          onZoomComplete: handleZoomPan
        }
      }
    }
  };

  return (
    <div className="relative w-full h-96 bg-gray-900 rounded-xl p-4 shadow-lg border border-gray-800">
      <Line ref={chartRef} options={options} data={chartData} />
      {zoomState && (
        <button 
          onClick={resetZoom}
          className="absolute top-4 right-4 bg-gray-800 hover:bg-gray-700 text-gray-300 p-2 rounded-lg border border-gray-600 shadow-md flex items-center justify-center transition-colors"
          title="Reset Zoom"
        >
          <Maximize size={16} />
        </button>
      )}
    </div>
  );
};

export default BBQChart;
