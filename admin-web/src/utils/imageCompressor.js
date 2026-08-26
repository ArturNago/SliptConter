/**
 * Utilitário de compressão de imagens no navegador via Canvas.
 * Reduz fotos de celulares de 8-15 MB para ~200-300 KB em milissegundos
 * antes do upload para a IA, otimizando o tráfego em redes de galpão.
 */

export async function comprimirImagem(file, maxWidth = 1280, qualidade = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;

        // Mantém a proporção redimensionando se maior que maxWidth
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            const arquivoComprimido = new File([blob], file.name || 'foto_pilha.jpg', {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(arquivoComprimido);
          },
          'image/jpeg',
          qualidade
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
