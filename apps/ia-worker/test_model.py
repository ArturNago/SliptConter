from inference.predict import predict_caixas
import os

imgs = [
    'C:/Codigos/SliptConter/ia-worker/training/img caixas empilhadas/IMG_3075.JPG',
    'C:/Codigos/SliptConter/ia-worker/training/img caixas empilhadas/IMG_3080.JPG',
    'C:/Codigos/SliptConter/ia-worker/training/img caixas empilhadas/IMG_3085.JPG',
]

for img in imgs:
    resultado = predict_caixas(img)
    nome = os.path.basename(img)
    caixas = resultado['caixas_por_camada']
    confianca = resultado['confianca']
    print(f'{nome}: {caixas} caixas (confianca: {confianca:.3f})')
