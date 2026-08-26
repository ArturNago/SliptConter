import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, AlertCircle } from 'lucide-react';
import { sound } from '../../services/soundFeedback';

export default function BarcodeScannerModal({ open, onClose, onScan }) {
  const videoRef = useRef(null);
  const [erro, setErro] = useState(null);
  const [stream, setStream] = useState(null);
  const [detectando, setDetectando] = useState(false);

  useEffect(() => {
    if (open) {
      iniciarCamera();
    } else {
      pararCamera();
    }
    return () => pararCamera();
  }, [open]);

  const iniciarCamera = async () => {
    setErro(null);
    setDetectando(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }

      // Loop de detecção nativa de código de barras
      iniciarLoopDeteccao(mediaStream);
    } catch (err) {
      setErro('Não foi possível acessar a câmera para escanear. Verifique as permissões.');
      setDetectando(false);
    }
  };

  const pararCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setDetectando(false);
  };

  const iniciarLoopDeteccao = async () => {
    if (!('BarcodeDetector' in window)) {
      // Navegadores sem BarcodeDetector nativo
      return;
    }

    try {
      const barcodeDetector = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a'],
      });

      const scanFrame = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          requestAnimationFrame(scanFrame);
          return;
        }

        try {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue.trim();
            sound.tocarSucesso();
            pararCamera();
            onScan(rawValue);
            return;
          }
        } catch (e) {
          // Frame sem código legível
        }

        requestAnimationFrame(scanFrame);
      };

      requestAnimationFrame(scanFrame);
    } catch (e) {
      console.warn('BarcodeDetector não suportado:', e);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: 460, width: '92%', padding: 0, overflow: 'hidden', borderRadius: 20 }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', backgroundColor: '#000' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />

          {/* Guia visual de enquadramento da mira */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '75%',
              height: '45%',
              border: '2px dashed #10b981',
              borderRadius: 12,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ position: 'absolute', top: -28, width: '100%', textAlign: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
              Alinhe o código de barras na mira
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'rgba(0,0,0,0.6)',
              border: 'none',
              borderRadius: 20,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 16, textAlign: 'center' }}>
          {erro ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--perigo)', fontSize: 13 }}>
              <AlertCircle size={18} />
              <span>{erro}</span>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--texto-suave)' }}>
              Aponte para o código de barras ou EAN do produto
            </div>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: 12, width: '100%' }}
            onClick={onClose}
          >
            Fechar Scanner
          </button>
        </div>
      </div>
    </div>
  );
}
