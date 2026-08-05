"""
Orquestra o ciclo de retreino periódico do YOLOv8 (doc, seção 5.6, completo):

    1. build_dataset.build()          -> monta train/val a partir do banco
    2. fine-tuning do YOLOv8           -> gera um novo candidato (best.pt)
    3. validate_model.validar()        -> compara candidato x produção
    4. se aprovado: promove o modelo e marca as conferências como "treinado"
       se reprovado: descarta o candidato, mantém o modelo em produção

Uso:
    python training/train.py
    (ou agendado via cron/worker periódico dentro do container ia-worker)
"""
import shutil
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

import config  # noqa: E402
from training import build_dataset, validate_model  # noqa: E402

EPOCHS = 50
IMG_SIZE = 640
BASE_WEIGHTS = "yolov8n.pt"  # ponto de partida: modelo pequeno pré-treinado (COCO)


def _marcar_conferencias_treinadas(ids):
    import psycopg2

    if not ids:
        return

    conn = psycopg2.connect(**config.DB)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE conferencias SET status_dataset = 'treinado' WHERE id = ANY(%s::uuid[])",
                (ids,),
            )
        conn.commit()
    finally:
        conn.close()


def treinar():
    from ultralytics import YOLO

    print("[train] 1/4 — montando dataset a partir do banco...")
    ids_incluidas = build_dataset.build()

    if not ids_incluidas:
        print("[train] nenhuma conferência pendente de treinamento. Abortando ciclo.")
        return

    data_yaml = config.DATASET_PATH / "data.yaml"
    ponto_partida = str(config.MODEL_PATH) if config.MODEL_PATH.exists() else BASE_WEIGHTS

    print(f"[train] 2/4 — fine-tuning a partir de '{ponto_partida}'...")
    model = YOLO(ponto_partida)
    resultado = model.train(data=str(data_yaml), epochs=EPOCHS, imgsz=IMG_SIZE, verbose=False)

    best_pt_gerado = Path(resultado.save_dir) / "weights" / "best.pt"
    config.MODELS_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best_pt_gerado, config.CANDIDATE_MODEL_PATH)

    print("[train] 3/4 — validando candidato contra conjunto de teste fixo...")
    resultado_validacao = validate_model.validar(config.CANDIDATE_MODEL_PATH)

    if resultado_validacao["aprovado"]:
        print("[train] 4/4 — candidato aprovado. Promovendo para produção.")
        shutil.copy2(config.CANDIDATE_MODEL_PATH, config.MODEL_PATH)
        _marcar_conferencias_treinadas(ids_incluidas)
    else:
        print("[train] 4/4 — candidato reprovado. Mantendo modelo anterior em produção.")

    return resultado_validacao


if __name__ == "__main__":
    treinar()
