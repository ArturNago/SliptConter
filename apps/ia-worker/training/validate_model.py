"""
Valida um novo `best.pt` (candidato) contra um conjunto de teste FIXO antes
de promovê-lo para produção (doc, seção 5.6, passo 5).

O conjunto de teste fixo mora em `ia-worker/training/fixed_testset/` e é
mantido manualmente estável entre ciclos de treino (não é regenerado por
build_dataset.py), justamente para servir de referência comparável entre
versões sucessivas do modelo. Estrutura esperada:

    training/fixed_testset/
        images/*.jpg
        labels/*.txt   (mesmo formato YOLO gerado em build_dataset.py)
        data.yaml
"""
from pathlib import Path

import config

FIXED_TESTSET_DIR = Path(__file__).resolve().parent / "fixed_testset"
FIXED_TESTSET_YAML = FIXED_TESTSET_DIR / "data.yaml"


def _testset_disponivel() -> bool:
    return FIXED_TESTSET_YAML.exists()


def _avaliar(model_path: Path) -> float:
    """Retorna o mAP50-95 do modelo no conjunto de teste fixo."""
    from ultralytics import YOLO

    model = YOLO(str(model_path))
    metrics = model.val(data=str(FIXED_TESTSET_YAML), split="test", verbose=False)
    return float(metrics.box.map)  # mAP50-95


def validar(candidate_path: Path = None):
    """
    Compara o modelo candidato com o modelo atualmente em produção.

    Returns:
        dict com `aprovado` (bool), `map_candidato`, `map_producao`.
        Se não houver conjunto de teste fixo configurado ainda, ou não
        houver modelo em produção (primeiro treino), o candidato é
        aprovado automaticamente.
    """
    candidate_path = candidate_path or config.CANDIDATE_MODEL_PATH

    if not candidate_path.exists():
        raise FileNotFoundError(f"Modelo candidato não encontrado em {candidate_path}")

    if not _testset_disponivel():
        print(
            "[validate_model] Conjunto de teste fixo ainda não configurado "
            f"em {FIXED_TESTSET_DIR}. Aprovando candidato sem comparação "
            "(configure o testset para validações futuras mais rigorosas)."
        )
        return {"aprovado": True, "map_candidato": None, "map_producao": None}

    map_candidato = _avaliar(candidate_path)

    if not config.MODEL_PATH.exists():
        print("[validate_model] Nenhum modelo em produção ainda — aprovando o primeiro treino.")
        return {"aprovado": True, "map_candidato": map_candidato, "map_producao": None}

    map_producao = _avaliar(config.MODEL_PATH)

    aprovado = map_candidato >= (map_producao + config.MIN_IMPROVEMENT)

    print(
        f"[validate_model] mAP candidato={map_candidato:.4f} "
        f"mAP produção={map_producao:.4f} aprovado={aprovado}"
    )

    return {
        "aprovado": aprovado,
        "map_candidato": map_candidato,
        "map_producao": map_producao,
    }


if __name__ == "__main__":
    validar()
