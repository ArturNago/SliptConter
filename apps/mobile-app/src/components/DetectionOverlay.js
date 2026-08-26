import React from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * Desenha as bounding boxes normalizadas (0–1) sobre a foto da pilha.
 *
 * As coordenadas vêm do worker YOLOv12 já normalizadas (x_center, y_center,
 * width, height em 0–1), então basta converter para porcentagem do container.
 *
 * @param {object} props
 * @param {Array} props.caixas lista de {x_center, y_center, width, height, conf}
 * @param {number} props.largura largura exibida da imagem (onLayout)
 * @param {number} props.altura altura exibida da imagem (onLayout)
 */
export default function DetectionOverlay({ caixas, largura, altura }) {
  if (!caixas || caixas.length === 0 || !largura || !altura) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {caixas.map((caixa, idx) => {
        const left = (caixa.x_center - caixa.width / 2) * largura;
        const top = (caixa.y_center - caixa.height / 2) * altura;
        const w = caixa.width * largura;
        const h = caixa.height * altura;

        return (
          <View
            key={idx}
            style={[
              styles.box,
              {
                left,
                top,
                width: w,
                height: h,
                borderColor: caixa.conf >= 0.7 ? '#10B981' : caixa.conf >= 0.5 ? '#F59E0B' : '#EF4444',
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
  },
});
