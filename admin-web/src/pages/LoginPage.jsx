import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Input, Button } from '../components/common';

export default function LoginPage() {
  const { login } = useAuth();
  const { erro } = useNotification();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setCarregando(true);
    try {
      await login(username, senha);
      navigate('/dashboard');
    } catch (err) {
      erro(err.response?.data?.erro || 'Falha ao autenticar. Verifique usuário e senha.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <img className="login-logo" src="/logo.svg" alt="SliptConter" />
        <h2>Painel Administrativo</h2>
        <p className="subtitle">Acesso restrito a Administradores e Gestores.</p>
        <Input
          label="Usuário"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="seu usuário"
          autoFocus
        />
        <Input
          label="Senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="••••••"
        />
        <Button variant="primary" type="submit" disabled={carregando} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
          <Lock size={16} /> {carregando ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </div>
  );
}
