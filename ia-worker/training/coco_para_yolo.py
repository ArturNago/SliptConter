"""
Converte anotações COCO JSON (exportado do Label Studio) para formato YOLO.

Formato YOLO: <class_id> <x_center> <y_center> <width> <height> (normalizado 0-1)

Classes mapeadas:
    0 = Caixa_Organizada
    1 = Caixa_Desorganizada
"""
import json
import os
import shutil
from pathlib import Path

# Diretórios
TRAINING_DIR = Path(__file__).resolve().parent
IMAGENS_ORIGEM = TRAINING_DIR / "img caixas empilhadas"
DATASET_DIR = Path(os.getenv("DATASET_PATH", "/dataset"))
TRAIN_DIR = DATASET_DIR / "images" / "train"
VAL_DIR = DATASET_DIR / "images" / "val"

# Mapeamento de classes
CATEGORIAS = {
    1: 0,  # Caixa_Organizada -> 0
    2: 1,  # Caixa_Desorganizada -> 1
}

VAL_SPLIT = 0.2


def coco_para_yolo_bbox(bbox, img_width, img_height):
    """Converte bbox COCO [x, y, w, h] para YOLO [x_center, y_center, w, h] normalizado."""
    x, y, w, h = bbox
    x_center = (x + w / 2) / img_width
    y_center = (y + h / 2) / img_height
    w_norm = w / img_width
    h_norm = h / img_height
    return x_center, y_center, w_norm, h_norm


def converter_coco_para_yolo(coco_json_path):
    """Converte arquivo COLO para formato YOLO e copia imagens."""
    with open(coco_json_path, encoding="utf-8") as f:
        data = json.load(f)

    # Indexa imagens por id
    imagens = {img["id"]: img for img in data["images"]}

    # Agrupa anotações por image_id
    anotacoes_por_imagem = {}
    for ann in data["annotations"]:
        img_id = ann["image_id"]
        if img_id not in anotacoes_por_imagem:
            anotacoes_por_imagem[img_id] = []
        anotacoes_por_imagem[img_id].append(ann)

    # Cria diretórios
    TRAIN_DIR.mkdir(parents=True, exist_ok=True)
    VAL_DIR.mkdir(parents=True, exist_ok=True)

    import random
    random.seed(42)

    imagens_processadas = 0
    caixas_total = 0

    for img_id, img_data in imagens.items():
        file_name = img_data["file_name"]
        img_width = img_data["width"]
        img_height = img_data["height"]

        # Caminho da imagem fonte
        origem_img = IMAGENS_ORIGEM / file_name
        if not origem_img.exists():
            print(f"[converter] Imagem não encontrada: {origem_img}")
            continue

        # Decide train/val
        destino_dir = VAL_DIR if random.random() < VAL_SPLIT else TRAIN_DIR

        # Copia imagem
        destino_img = destino_dir / file_name
        if not destino_img.exists():
            shutil.copy2(origem_img, destino_img)

        # Gera label YOLO
        label_lines = []
        for ann in anotacoes_por_imagem.get(img_id, []):
            category_id = ann["category_id"]
            bbox = ann["bbox"]

            if category_id not in CATEGORIAS:
                continue

            classe_yolo = CATEGORIAS[category_id]
            x_center, y_center, w, h = coco_para_yolo_bbox(bbox, img_width, img_height)

            # Clipa para [0, 1]
            x_center = max(0, min(1, x_center))
            y_center = max(0, min(1, y_center))
            w = max(0, min(1, w))
            h = max(0, min(1, h))

            label_lines.append(f"{classe_yolo} {x_center:.6f} {y_center:.6f} {w:.6f} {h:.6f}")

        # Escreve arquivo .txt
        nome_base = Path(file_name).stem
        destino_label = destino_dir / f"{nome_base}.txt"
        destino_label.write_text("\n".join(label_lines), encoding="utf-8")

        imagens_processadas += 1
        caixas_total += len(label_lines)

    print(f"[converter] {imagens_processadas} imagens processadas")
    print(f"[converter] {caixas_total} caixas convertidas")
    print(f"[converter] Train: {len(list(TRAIN_DIR.glob('*.jpg')))} imagens")
    print(f"[converter] Val: {len(list(VAL_DIR.glob('*.jpg')))} imagens")

    return imagens_processadas


def escrever_data_yaml():
    """Escreve data.yaml para o YOLOv12."""
    data_yaml = DATASET_DIR / "data.yaml"
    conteudo = (
        f"train: {TRAIN_DIR}\n"
        f"val: {VAL_DIR}\n"
        f"nc: 2\n"
        f"names: ['Caixa_Organizada', 'Caixa_Desorganizada']\n"
    )
    data_yaml.write_text(conteudo, encoding="utf-8")
    print(f"[converter] data.yaml escrito em {data_yaml}")


def main():
    # Encontra arquivos COCO JSON
    json_files = sorted(TRAINING_DIR.glob("labels_*.json"))
    if not json_files:
        print("[converter] Nenhum arquivo labels_*.json encontrado")
        return

    # Usa o mais recente
    coco_json = json_files[-1]
    print(f"[converter] Usando: {coco_json.name}")

    converter_coco_para_yolo(coco_json)
    escrever_data_yaml()

    print("\n[converter] Conversão concluída!")
    print("[converter] Execute: python training/train.py")


if __name__ == "__main__":
    main()
