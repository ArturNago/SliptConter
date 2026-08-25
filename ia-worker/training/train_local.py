"""
Treinamento local do YOLOv12 para detecção de caixas.

Usa o dataset já preparado em /dataset/images/{train,val} com anotações
manuais (convertidas de COCO para YOLO).

Uso:
    python training/train_local.py
"""
import shutil
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

import config  # noqa: E402

EPOCHS = 50
IMG_SIZE = 640
BASE_WEIGHTS = "yolo12n.pt"


def treinar_local():
    from ultralytics import YOLO

    data_yaml = config.DATASET_PATH / "data.yaml"
    if not data_yaml.exists():
        print(f"[train_local] data.yaml não encontrado em {data_yaml}")
        print("[train_local] Execute: python training/coco_para_yolo.py")
        return

    # Verifica se há imagens de treinamento
    train_imgs = list(config.TRAIN_DIR.glob("*.jpg")) + list(config.TRAIN_DIR.glob("*.JPG"))
    val_imgs = list(config.VAL_DIR.glob("*.jpg")) + list(config.VAL_DIR.glob("*.JPG"))
    print(f"[train_local] Dataset: {len(train_imgs)} train, {len(val_imgs)} val")

    if not train_imgs:
        print("[train_local] Nenhuma imagem de treinamento encontrada")
        return

    # Ponto de partida: modelo pré-treinado YOLOv12n
    ponto_partida = BASE_WEIGHTS
    if config.MODEL_PATH.exists():
        print(f"[train_local] Continuando treino de {config.MODEL_PATH}")
        ponto_partida = str(config.MODEL_PATH)

    print(f"[train_local] Iniciando treinamento com {EPOCHS} épocas, imgsz={IMG_SIZE}...")
    model = YOLO(ponto_partida)

    resultado = model.train(
        data=str(data_yaml),
        epochs=EPOCHS,
        imgsz=IMG_SIZE,
        batch=8,
        patience=10,
        save=True,
        verbose=True,
        exist_ok=True,
    )

    best_pt_gerado = Path(resultado.save_dir) / "weights" / "best.pt"
    if not best_pt_gerado.exists():
        print("[train_local] ERRO: best.pt não foi gerado")
        return

    config.MODELS_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best_pt_gerado, config.MODEL_PATH)
    print(f"[train_local] Modelo salvo em {config.MODEL_PATH}")

    # Validação
    print("[train_local] Executando validação...")
    metrics = model.val(data=str(data_yaml), verbose=False)
    print(f"[train_local] mAP50-95: {metrics.box.map:.4f}")
    print(f"[train_local] mAP50: {metrics.box.map50:.4f}")

    return resultado


if __name__ == "__main__":
    treinar_local()
