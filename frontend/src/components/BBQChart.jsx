
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

const BBQChart = ({ data, targetTemp }) => {
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

  // Add a horizontal line for the target temp if it exists
  const annotations = targetTemp ? {
    annotations: {
      targetLine: {
        type: 'line',
        yMin: targetTemp,
        yMax: targetTemp,
        borderColor: 'rgb(75, 192, 192)',
        borderWidth: 2,
        borderDash: [5, 5],
        label: {
          display: true,
          content: 'Target',
          position: 'end'
        }
      }
    }
  } : {};

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
        grid: { color: '#333' }
      },
      y: {
        title: {
          display: true,
          text: 'Temperature (°F)',
          color: '#ccc'
        },
        ticks: { color: '#ccc' },
        grid: { color: '#333' }
      }
    },
    plugins: {
      legend: {
        labels: { color: '#ccc' }
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'xy', // Allow panning in both directions
          overScaleMode: 'xy', // Allows panning just one axis when hovering over it
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true
          },
          mode: 'xy', // Allow zooming in both directions
          overScaleMode: 'xy', // Allows zooming just one axis when hovering over it
        }
      },
      annotation: annotations // Note: Needs chartjs-plugin-annotation if used, but we'll stick to basic lines or just add a dataset for target
    }
  };

  // Since we didn't install chartjs-plugin-annotation, let's just add the target as a dataset
  if (targetTemp && data.length > 0) {
    chartData.datasets.push({
      label: 'Target Temp',
      data: [
        { x: new Date(data[0].timestamp.replace(' ', 'T') + 'Z'), y: targetTemp },
        { x: new Date(data[data.length - 1].timestamp.replace(' ', 'T') + 'Z'), y: targetTemp }
      ],
      borderColor: 'rgb(75, 192, 192)',
      borderDash: [5, 5],
      pointRadius: 0,
      borderWidth: 2
    });
  }

  return (
    <div className="w-full h-96 bg-gray-900 rounded-xl p-4 shadow-lg border border-gray-800">
      <Line options={options} data={chartData} />
    </div>
  );
};

export default BBQChart;
