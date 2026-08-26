"""
Script para anotar imagens de caixas empilhadas no formato YOLO.

Uso:
    python training/annotate_local.py

Ferramenta simples que:
1. Lista imagens de `training/img caixas empilhadas/`
2. Abre cada uma no visualizador padrão do sistema para inspeção
3. Gera arquivos .txt YOLO vazio (pronto para preencher com coordenadas)

Para anotar de fato, use:
    - Label Studio (recomendado): https://studiolabelbuilder.com/
    - labelImg: pip install labelimg && labelImg

Formato YOLO esperado por caixa:
    <class_id> <x_center> <y_center> <width> <height>
    (valores normalizados 0-1)

Exemplo (classe 0 = caixa):
    0 0.25 0.30 0.15 0.20
    0 0.50 0.30 0.15 0.20
    0 0.75 0.30 0.15 0.20
"""
import os
import sys
from pathlib import Path

# Adiciona raiz do projeto ao path
sys.path.append(str(Path(__file__).resolve().parent.parent))

import config

# Diretório de imagens reais (fornecido pelo usuario)
IMAGENS_DIR = Path(__file__).resolve().parent / "img caixas empilhadas"

# Diretório de saída para labels YOLO
LABELS_OUTPUT = config.DATASET_PATH / "images" / "train"

CLASSE_CAIXA = 0


def listar_imagens():
    """Lista todas as imagens JPG no diretório."""
    if not IMAGENS_DIR.exists():
        print(f"[annotate] Diretório não encontrado: {IMAGENS_DIR}")
        return []

    extensoes = {'.jpg', '.jpeg', '.png'}
    imagens = [
        f for f in IMAGENS_DIR.iterdir()
        if f.suffix.lower() in extensoes and f.is_file()
    ]
    return sorted(imagens)


def gerar_labels_vazios(imagens):
    """Gera arquivos .txt YOLO vazios para cada imagem (pronto para anotar)."""
    LABELS_OUTPUT.mkdir(parents=True, exist_ok=True)

    criados = 0
    for img in imagens:
        label_path = LABELS_OUTPUT / f"{img.stem}.txt"
        if not label_path.exists():
            label_path.write_text("", encoding="utf-8")
            criados += 1

    print(f"[annotate] {criados} labels vazios criados em {LABELS_OUTPUT}")
    return criados


def copiar_para_dataset(imagens):
    """Copia imagens para o diretório do dataset (train/val)."""
    config.TRAIN_DIR.mkdir(parents=True, exist_ok=True)
    config.VAL_DIR.mkdir(parents=True, exist_ok=True)

    import random
    random.seed(42)

    copiadas = 0
    for img in imagens:
        # 80% train, 20% val
        destino_dir = config.VAL_DIR if random.random() < 0.2 else config.TRAIN_DIR
        destino = destino_dir / img.name
        if not destino.exists():
            import shutil
            shutil.copy2(img, destino)
            copiadas += 1

    print(f"[annotate] {copiadas} imagens copiadas para dataset (train/val)")
    return copiadas


def verificar_labels():
    """Verifica quantas imagens têm labels preenchidos."""
    if not LABELS_OUTPUT.exists():
        return 0, 0

    imagens_com_label = 0
    total_labels = 0
    for txt in LABELS_OUTPUT.glob("*.txt"):
        conteudo = txt.read_text(encoding="utf-8").strip()
        if conteudo:
            imagens_com_label += 1
            total_labels += len(conteudo.split("\n"))

    return imagens_com_label, total_labels


def main():
    print("=" * 60)
    print("Anotação de imagens - YOLOv12 caixas")
    print("=" * 60)

    imagens = listar_imagens()
    if not imagens:
        print("[annotate] Nenhuma imagem encontrada.")
        print(f"[annotate] Diretório esperado: {IMAGENS_DIR}")
        return

    print(f"\n[annotate] {len(imagens)} imagens encontradas:")
    for img in imagens[:5]:
        print(f"  - {img.name}")
    if len(imagens) > 5:
        print(f"  ... e mais {len(imagens) - 5}")

    print("\n[annotate] Copiando para dataset...")
    copiar_para_dataset(imagens)

    print("\n[annotate] Gerando labels vazios (pronto para anotar)...")
    gerar_labels_vazios(imagens)

    com_label, total = verificar_labels()
    print(f"\n[annotate] Status: {com_label}/{len(imagens)} imagens anotadas")
    print(f"[annotate] Total de caixas anotadas: {total}")

    print("\n" + "=" * 60)
    print("PRÓXIMOS PASSOS:")
    print("=" * 60)
    print(f"1. Anote as imagens em: {LABELS_OUTPUT}")
    print("   Use Label Studio ou labelImg para desenhar bounding boxes")
    print("   Classe: 0 (caixa)")
    print("")
    print("2. Após anotar, execute:")
    print("   python training/build_dataset.py")
    print("")
    print("3. Para treinar:")
    print("   python training/train.py")
    print("=" * 60)


if __name__ == "__main__":
    main()
