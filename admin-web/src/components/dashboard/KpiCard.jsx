import React from 'react';
import { Card } from '../common';

const TONE_COLORS = {
  primary: { bg: 'color-mix(in srgb, var(--primario) 14%, transparent)', accent: 'var(--primario)' },
  success: { bg: 'color-mix(in srgb, var(--sucesso) 14%, transparent)', accent: 'var(--sucesso)' },
  warning: { bg: 'color-mix(in srgb, var(--aviso) 14%, transparent)', accent: 'var(--aviso)' },
  danger: { bg: 'color-mix(in srgb, var(--perigo) 14%, transparent)', accent: 'var(--perigo)' },
};

export function KpiCard({ label, value, icon: Icon, tone = 'primary', trend, subtitle }) {
  const colors = TONE_COLORS[tone] || TONE_COLORS.primary;

  return (
    <div
      className="kpi-card"
      style={{
        background: colors.bg,
        borderColor: `color-mix(in srgb, ${colors.accent} 28%, transparent)`,
        animation: 'kpiEnter 0.4s ease both',
      }}
    >
      <div className="kpi-label" style={{ color: colors.accent }}>
        {Icon && (
          <span className="kpi-icon" style={{ background: colors.bg, color: colors.accent, border: `1px solid color-mix(in srgb, ${colors.accent} 22%, transparent)` }}>
            <Icon size={20} />
          </span>
        )}
        {label}
      </div>
      <div className="kpi-value" style={{ color: 'var(--texto)' }}>
        {value}
        {trend === 'up' && <span style={{ color: 'var(--sucesso)', fontSize: 14, marginLeft: 8 }}>▲</span>}
        {trend === 'down' && <span style={{ color: 'var(--perigo)', fontSize: 14, marginLeft: 8 }}>▼</span>}
      </div>
      {subtitle && <div style={{ color: 'var(--texto-suave)', fontSize: 12, marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}
