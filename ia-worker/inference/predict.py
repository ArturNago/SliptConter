"""
Roda o YOLOv8 sobre a foto de uma pilha e retorna o número de camadas
sugerido (doc, seção 5.2 — "V1: YOLOv8 sugere o número de camadas").

O modelo é treinado para detectar a classe "camada" (uma caixa por camada
visível na foto, seguindo o overlay-guia do app). O número de camadas é
simplesmente a contagem de detecções acima do limiar de confiança.
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


def predict_camadas(image_path: str, model_path: str | None = None):
    """
    Executa a inferência sobre uma imagem.

    Args:
        image_path: caminho absoluto da foto da pilha.
        model_path: opcional, usado por validate_model.py para testar um
            candidato diferente do modelo em produção.

    Returns:
        dict com `camadas_sugeridas` (int) e `confianca` (float, 0-1),
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
        return {"camadas_sugeridas": 0, "confianca": 0.0}

    result = results[0]
    boxes = result.boxes

    if boxes is None or len(boxes) == 0:
        return {"camadas_sugeridas": 0, "confianca": 0.0}

    confidencias = boxes.conf.tolist()
    validas = [c for c in confidencias if c >= config.CONFIDENCE_THRESHOLD]

    camadas_sugeridas = len(validas)
    confianca_media = sum(validas) / len(validas) if validas else 0.0

    return {"camadas_sugeridas": camadas_sugeridas, "confianca": round(confianca_media, 4)}
