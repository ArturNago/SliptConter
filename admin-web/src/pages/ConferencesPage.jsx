import React, { useState } from 'react';
import { useConferencias } from '../hooks/useStock';
import { ConferenceCard, PhotoViewerModal } from '../components/conferencias';
import { Spinner } from '../components/common';

export default function ConferencesPage() {
  const { data, loading } = useConferencias({ limit: 100 });
  const [selecionada, setSelecionada] = useState(null);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Spinner size={40} />
      </div>
    );
  }

  return (
    <div>
      <p style={{ color: 'var(--texto-suave)' }}>
        Auditoria das conferências realizadas no galpão. Clique em um cartão para ver a foto e o comparativo IA × operador.
      </p>
      <div className="photo-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {(data || []).map((c) => (
          <ConferenceCard key={c.id} conferencia={c} onClick={() => setSelecionada(c)} />
        ))}
      </div>
      <PhotoViewerModal open={!!selecionada} conferencia={selecionada} onClose={() => setSelecionada(null)} />
    </div>
  );
}
