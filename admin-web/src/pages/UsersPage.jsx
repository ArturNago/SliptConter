import React, { useState } from 'react';
import { useUsuarios } from '../hooks/useStock';
import { Table, Button, Badge, Modal } from '../components/common';
import { UserFormModal, BadgeQrModal } from '../components/users';
import { useNotification } from '../contexts/NotificationContext';
import http from '../services/api';

export default function UsersPage() {
  const { data, loading, recarregar } = useUsuarios();
  const { sucesso, erro } = useNotification();
  const [formAberto, setFormAberto] = useState(false);
  const [qrAberto, setQrAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [cracha, setCracha] = useState(null);

  const salvarUsuario = async (payload) => {
    try {
      if (editando?.id) {
        await http.patch(`/admin/usuarios/${editando.id}`, payload);
      } else {
        await http.post('/admin/usuarios', payload);
      }
      sucesso('Operador salvo com sucesso.');
      recarregar();
    } catch (e) {
      erro(e.response?.data?.erro || 'Falha ao salvar operador.');
    }
  };

  const columns = [
    { key: 'nome', label: 'Nome', style: { fontWeight: 600 } },
    { key: 'username', label: 'Usuário' },
    {
      key: 'papel',
      label: 'Papel',
      render: (v) => <Badge tone={v === 'admin' ? 'primary' : v === 'gestor' ? 'warning' : 'neutral'}>{v}</Badge>,
    },
    {
      key: 'ativo',
      label: 'Status',
      render: (v) => <Badge tone={v ? 'success' : 'danger'}>{v ? 'Ativo' : 'Inativo'}</Badge>,
    },
    {
      key: 'acoes',
      label: 'Ações',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditando(row); setFormAberto(true); }}>
            Editar
          </Button>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setCracha(row); setQrAberto(true); }}>
            Crachá
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button variant="primary" onClick={() => { setEditando(null); setFormAberto(true); }}>
          Novo Operador
        </Button>
      </div>
      <Table columns={columns} data={data} loading={loading} />
      <UserFormModal open={formAberto} onClose={() => setFormAberto(false)} usuario={editando} onSave={salvarUsuario} />
      <BadgeQrModal open={qrAberto} onClose={() => setQrAberto(false)} usuario={cracha} />
    </div>
  );
}
