import React from 'react';
import { Modal, Badge, Button } from '../common';
import { formatarData, formatarNumero } from '../../utils/formatters';

// URL base da API para servir as imagens do volume Docker.
const API_URL = (typeof __API_URL__ !== 'undefined' ? __API_URL__ : 'https://estoque.puratienda.store');

export function ConferenceCard({ conferencia, onClick }) {
  const statusTone = {
    pendente_treinamento: 'warning',
    treinado: 'success',
    na: 'neutral',
  };
  return (
    <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--texto-suave)' }}>{formatarData(conferencia.created_at)}</span>
        <Badge tone={statusTone[conferencia.status_dataset] || 'neutral'}>
          {conferencia.status_dataset}
        </Badge>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Contada</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{formatarNumero(conferencia.quantidade_contada)}</div>
        </div>
        {conferencia.quantidade_sugerida_ia != null && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--texto-suave)' }}>IA</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{formatarNumero(conferencia.quantidade_sugerida_ia)}</div>
          </div>
        )}
        <div>
          <div style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Ajuste</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--aviso)' }}>
            {conferencia.ajuste_manual > 0 ? `+${conferencia.ajuste_manual}` : conferencia.ajuste_manual}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PhotoViewerModal({ open, onClose, conferencia }) {
  if (!conferencia) return null;
  const imagemUrl = conferencia.url_imagem_local
    ? `${API_URL}${conferencia.url_imagem_local.startsWith('/') ? '' : '/'}${conferencia.url_imagem_local}`
    : null;

  return (
    <Modal open={open} onClose={onClose} title="Detalhe da Conferência" footer={
      <Button variant="ghost" onClick={onClose}>Fechar</Button>
    }>
      {imagemUrl ? (
        <img src={imagemUrl} alt="Conferência" style={{ width: '100%', borderRadius: 10, marginBottom: 16 }} />
      ) : (
        <div className="table-empty">Sem imagem anexada.</div>
      )}
      <div className="stat-row">
        <div className="stat-pill">
          Quantidade informada
          <b>{formatarNumero(conferencia.quantidade_contada)}</b>
        </div>
        <div className="stat-pill">
          Sugestão IA
          <b>{conferencia.quantidade_sugerida_ia != null ? formatarNumero(conferencia.quantidade_sugerida_ia) : '—'}</b>
        </div>
        <div className="stat-pill">
          Ajuste manual
          <b>{conferencia.ajuste_manual}</b>
        </div>
        <div className="stat-pill">
          Origem
          <b>{conferencia.origem}</b>
        </div>
        <div className="stat-pill">
          Dataset
          <b>{conferencia.status_dataset}</b>
        </div>
      </div>
      <p style={{ color: 'var(--texto-suave)', fontSize: 13 }}>
        Registrado em {formatarData(conferencia.created_at)}
      </p>
    </Modal>
  );
}
