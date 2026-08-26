/**
 * Feedback sonoro e tátil (vibração) para operações no galpão via Web Audio API.
 * Não requer arquivos externos de áudio (.mp3), gerando ondas senoidais puras direto no navegador.
 */

class SoundFeedback {
  constructor() {
    this.audioCtx = null;
  }

  _initContext() {
    if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Beep curto e agudo de sucesso (bipagem ou contagem confirmada)
  tocarSucesso() {
    try {
      this._initContext();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, this.audioCtx.currentTime); // 1.2 kHz
      osc.frequency.exponentialRampToValueAtTime(1800, this.audioCtx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.12);

      // Vibração tátil no celular se suportado
      if (navigator.vibrate) {
        navigator.vibrate(60);
      }
    } catch (e) {
      // Audio desabilitado pelo navegador antes de interação
    }
  }

  // Tom duplo de alerta / erro
  tocarErro() {
    try {
      this._initContext();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, this.audioCtx.currentTime);
      osc.frequency.setValueAtTime(220, this.audioCtx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.35, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.25);

      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch (e) {
      // Ignora erro de áudio
    }
  }
}

export const sound = new SoundFeedback();
