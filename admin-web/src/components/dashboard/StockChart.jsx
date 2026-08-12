import React, { useMemo } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { useTheme } from '../../contexts/ThemeContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
);

export function StockLineChart({ serie }) {
  const { cores } = useTheme();
  const data = useMemo(() => {
    const labels = serie.map((s) => new Date(s.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    return {
      labels,
      datasets: [
        {
          label: 'Entradas',
          data: serie.map((s) => s.entradas),
          borderColor: cores.sucesso,
          backgroundColor: 'transparent',
          tension: 0.35,
          fill: false,
        },
        {
          label: 'Saídas',
          data: serie.map((s) => s.saidas),
          borderColor: cores.perigo,
          backgroundColor: 'transparent',
          tension: 0.35,
          fill: false,
        },
        {
          label: 'Ajustes',
          data: serie.map((s) => s.ajustes),
          borderColor: cores.aviso,
          backgroundColor: 'transparent',
          tension: 0.35,
          fill: false,
        },
      ],
    };
  }, [serie, cores]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: cores.textoSuave } } },
    scales: {
      x: { ticks: { color: cores.textoSuave }, grid: { color: cores.borda } },
      y: { ticks: { color: cores.textoSuave }, grid: { color: cores.borda }, beginAtZero: true },
    },
  };

  return (
    <div className="chart-box">
      <Line data={data} options={options} />
    </div>
  );
}

export function DistributionDoughnut({ titulo, dados, labelKey = 'nome', valueKey = 'saldo' }) {
  const { cores } = useTheme();
  const palette = [cores.primario, cores.sucesso, cores.aviso, cores.perigo, '#8b5cf6', '#06b6d4', '#ec4899'];
  const data = {
    labels: dados.map((d) => d[labelKey]),
    datasets: [
      {
        data: dados.map((d) => d[valueKey]),
        backgroundColor: dados.map((_, i) => palette[i % palette.length]),
        borderColor: cores.bg,
        borderWidth: 2,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { color: cores.textoSuave, boxWidth: 12 } },
    },
  };
  return (
    <div className="chart-box">
      <Doughnut data={data} options={options} />
    </div>
  );
}
