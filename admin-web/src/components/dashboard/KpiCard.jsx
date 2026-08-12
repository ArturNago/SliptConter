import React from 'react';
import { Card } from '../common';

export function KpiCard({ label, value, icon: Icon, tone = 'primary' }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">
        {Icon && (
          <span className="kpi-icon">
            <Icon size={18} />
          </span>
        )}
        {label}
      </div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}
