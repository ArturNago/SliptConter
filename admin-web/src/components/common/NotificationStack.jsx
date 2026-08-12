import React from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ICONS = {
  sucesso: CheckCircle2,
  erro: XCircle,
  info: Info,
};

const COLORS = {
  sucesso: 'var(--sucesso)',
  erro: 'var(--perigo)',
  info: 'var(--primario)',
};

export default function NotificationStack() {
  const { notificacoes, remover } = useNotification();
  return (
    <div className="notification-stack">
      {notificacoes.map((n) => {
        const Icon = ICONS[n.tipo] || Info;
        return (
          <div key={n.id} className={`notification ${n.tipo}`}>
            <Icon size={18} color={COLORS[n.tipo]} />
            <span style={{ flex: 1 }}>{n.mensagem}</span>
            <button className="modal-close" onClick={() => remover(n.id)} style={{ fontSize: 18 }}>
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
