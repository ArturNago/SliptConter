import { useState, useEffect } from 'react';
import api from '../services/api';

export default function usePermissao() {
  const [usuario, setUsuario] = useState(null);
  const [isGestor, setIsGestor] = useState(false);

  useEffect(() => {
    (async () => {
      const sessao = await api.obterSessao();
      if (sessao?.usuario) {
        setUsuario(sessao.usuario);
        setIsGestor(['gestor', 'admin'].includes(sessao.usuario.papel));
      }
    })();
  }, []);

  return { usuario, isGestor };
}
