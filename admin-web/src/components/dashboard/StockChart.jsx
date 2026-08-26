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

const LINE_PALETTE = {
  entradas: '#10b981',
  saidas: '#ef4444',
  ajustes: '#f59e0b',
};

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
          borderColor: LINE_PALETTE.entradas,
          backgroundColor: 'transparent',
          tension: 0.35,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: LINE_PALETTE.entradas,
        },
        {
          label: 'Saídas',
          data: serie.map((s) => s.saidas),
          borderColor: LINE_PALETTE.saidas,
          backgroundColor: 'transparent',
          tension: 0.35,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: LINE_PALETTE.saidas,
        },
        {
          label: 'Ajustes',
          data: serie.map((s) => s.ajustes),
          borderColor: LINE_PALETTE.ajustes,
          backgroundColor: 'transparent',
          tension: 0.35,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: LINE_PALETTE.ajustes,
        },
      ],
    };
  }, [serie]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: cores.textoSuave,
          usePointStyle: true,
          pointStyleWidth: 8,
          padding: 16,
          font: { size: 12 },
        },
      },
      tooltip: {
        backgroundColor: cores.bgElevado,
        titleColor: cores.texto,
        bodyColor: cores.textoSuave,
        borderColor: cores.borda,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        boxPadding: 4,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: cores.textoSuave, font: { size: 11 } },
        grid: { color: cores.borda, drawBorder: false },
      },
      y: {
        ticks: { color: cores.textoSuave, font: { size: 11 } },
        grid: { color: cores.borda, drawBorder: false },
        beginAtZero: true,
      },
    },
  }), [cores]);

  return (
    <div className="chart-box" style={{ animation: 'chartEnter 0.5s ease both' }}>
      <Line data={data} options={options} />
    </div>
  );
}

export function DistributionDoughnut({ titulo, dados, labelKey = 'nome', valueKey = 'saldo' }) {
  const { cores } = useTheme();
  const palette = [cores.primario, cores.sucesso, cores.aviso, cores.perigo, '#8b5cf6', '#06b6d4', '#ec4899'];
  const data = useMemo(() => ({
    labels: dados.map((d) => d[labelKey]),
    datasets: [
      {
        data: dados.map((d) => d[valueKey]),
        backgroundColor: dados.map((_, i) => palette[i % palette.length]),
        borderColor: cores.bg,
        borderWidth: 3,
        hoverBorderColor: cores.texto,
        hoverBorderWidth: 2,
      },
    ],
  }), [dados, palette, cores, labelKey, valueKey]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    animation: { animateRotate: true, duration: 700 },
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: cores.textoSuave,
          usePointStyle: true,
          pointStyleWidth: 8,
          padding: 14,
          font: { size: 12 },
        },
      },
      tooltip: {
        backgroundColor: cores.bgElevado,
        titleColor: cores.texto,
        bodyColor: cores.textoSuave,
        borderColor: cores.borda,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        boxPadding: 4,
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const current = ctx.parsed;
            const pct = total > 0 ? ((current / total) * 100).toFixed(1) : 0;
            return ` ${ctx.label}: ${current} (${pct}%)`;
          },
        },
      },
    },
  }), [cores]);

  return (
    <div className="chart-box" style={{ animation: 'chartEnter 0.5s ease both' }}>
      <Doughnut data={data} options={options} />
    </div>
  );
}
