"""
Roda o YOLOv12 sobre a foto de uma pilha e retorna as caixas da camada
frontal detectadas (doc, seção 5.2 — "V1: YOLOv12 sugere contagem de caixas").

O modelo é treinado para detectar a classe "caixa" (uma bbox por caixa da
camada frontal visível na foto, seguindo o overlay-guia do app). O número de
caixas da camada é a contagem de detecções acima do limiar de confiança.

Coordenadas são normalizadas (0–1, padrão YOLO) para que o overlay do app
escale em qualquer dispositivo.
"""
from pathlib import Path
from functools import lru_cache

import sys

sys.path.append(str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402


@lru_cache(maxsize=1)
def _load_model():
    """Carrega o modelo em produção (best.pt) uma única vez por processo."""
    from ultralytics import YOLO

    if not config.MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Nenhum modelo treinado encontrado em {config.MODEL_PATH}. "
            "Rode training/train.py ao menos uma vez (após acumular dataset da V0)."
        )
    return YOLO(str(config.MODEL_PATH))


def modelo_disponivel() -> bool:
    return config.MODEL_PATH.exists()


def predict_caixas(image_path: str, model_path: str | None = None):
    """
    Executa a inferência sobre uma imagem.

    Args:
        image_path: caminho absoluto da foto da pilha.
        model_path: opcional, usado por validate_model.py para testar um
            candidato diferente do modelo em produção.

    Returns:
        dict com:
            caixas: [{x_center, y_center, width, height, conf}] (coords 0–1)
            caixas_por_camada: int (nº de detecções ≥ limiar)
            confianca: float (média das confs válidas, 0–1)
        ou None se o modelo não estiver disponível.
    """
    if model_path:
        from ultralytics import YOLO

        model = YOLO(model_path)
    else:
        if not modelo_disponivel():
            return None
        model = _load_model()

    results = model.predict(source=image_path, verbose=False)
    if not results:
        return {"caixas": [], "caixas_por_camada": 0, "confianca": 0.0}

    result = results[0]
    boxes = result.boxes

    if boxes is None or len(boxes) == 0:
        return {"caixas": [], "caixas_por_camada": 0, "confianca": 0.0}

    confidencias = boxes.conf.tolist()
    validas = [c for c in confidencias if c >= config.CONFIDENCE_THRESHOLD]

    if not validas:
        return {"caixas": [], "caixas_por_camada": 0, "confianca": 0.0}

    caixas = []
    for i, box in enumerate(boxes):
        conf = float(confidencias[i])
        if conf < config.CONFIDENCE_THRESHOLD:
            continue
        xywh = box.xywhn.tolist()[0]
        caixas.append({
            "x_center": round(float(xywh[0]), 6),
            "y_center": round(float(xywh[1]), 6),
            "width": round(float(xywh[2]), 6),
            "height": round(float(xywh[3]), 6),
            "conf": round(conf, 4),
        })

    caixas_por_camada = len(caixas)
    confianca_media = sum(c["conf"] for c in caixas) / caixas_por_camada

    return {
        "caixas": caixas,
        "caixas_por_camada": caixas_por_camada,
        "confianca": round(confianca_media, 4),
    }
