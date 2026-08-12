import React, { useState } from 'react';
import { Modal, Button, Input, Select } from '../common';
import { QRCodeCanvas } from 'qrcode.react';

export function UserFormModal({ open, onClose, usuario, onSave }) {
  const [nome, setNome] = useState(usuario?.nome || '');
  const [username, setUsername] = useState(usuario?.username || '');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState(usuario?.papel || 'operador');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    try {
      await onSave({ nome, username, senha, papel });
      onClose();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={usuario ? 'Editar Operador' : 'Novo Operador'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
        </>
      }
    >
      <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
      <Input label="Usuário (login)" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
      <Input label="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••" />
      <Select label="Papel" value={papel} onChange={(e) => setPapel(e.target.value)}>
        <option value="operador">Operador</option>
        <option value="gestor">Gestor</option>
        <option value="admin">Administrador</option>
      </Select>
    </Modal>
  );
}

export function BadgeQrModal({ open, onClose, usuario }) {
  if (!usuario) return null;
  const payload = JSON.stringify({ id: usuario.id, nome: usuario.nome, username: usuario.username, papel: usuario.papel });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Crachá — ${usuario.nome}`}
      footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ background: '#fff', padding: 12, borderRadius: 12 }}>
          <QRCodeCanvas value={payload} size={200} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{usuario.nome}</div>
          <div style={{ color: 'var(--texto-suave)' }}>@{usuario.username} · {usuario.papel}</div>
        </div>
        <Button variant="primary" onClick={() => window.print()}>Imprimir Crachá</Button>
      </div>
    </Modal>
  );
}
