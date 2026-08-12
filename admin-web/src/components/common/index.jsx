import React from 'react';

export function Button({ variant = 'primary', size = 'md', children, ...props }) {
  return (
    <button className={`btn btn-${variant} btn-${size}`} {...props}>
      {children}
    </button>
  );
}

export function Input({ label, error, ...props }) {
  return (
    <div className="field">
      {label && <label className="field-label">{label}</label>}
      <input className={`input ${error ? 'input-error' : ''}`} {...props} />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export function Select({ label, children, ...props }) {
  return (
    <div className="field">
      {label && <label className="field-label">{label}</label>}
      <select className="input select" {...props}>
        {children}
      </select>
    </div>
  );
}

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Spinner({ size = 24 }) {
  return <div className="spinner" style={{ width: size, height: size }} />;
}

export function Table({ columns, data, loading, onRowClick, emptyMessage = 'Nenhum registro encontrado.' }) {
  if (loading) {
    return (
      <div className="table-loading">
        <Spinner />
      </div>
    );
  }
  if (!data || data.length === 0) {
    return <div className="table-empty">{emptyMessage}</div>;
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.style}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id ?? i} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {columns.map((c) => (
                <td key={c.key} style={c.style}>
                  {c.render ? c.render(row[c.key], row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
