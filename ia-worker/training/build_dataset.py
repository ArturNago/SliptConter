"""
Monta as pastas train/val a partir do banco (doc, seção 5.6, passos 1-3).

Fonte da verdade: tabela `conferencias`, filtrando
`status_dataset = 'pendente_treinamento'`. Cada conferência confirmada
gera:
  - uma imagem copiada de /dataset/inbound para /dataset/images/{train,val}
  - um arquivo de label YOLO (.txt) com uma bbox por caixa da camada frontal

Esquema novo (migration 017):
  - Lê `quantidade_contada` (renomeada de `camadas_informadas` na migration 011).
  - Lê `caixas_por_camada` e `deteccoes_ia` (JSONB com as boxes normalizadas).
  - Gera labels YOLO da classe `caixa` a partir das detecções reais da IA
    (não mais heurística de faixas horizontais sintéticas).
"""
import json
import random
import shutil
from pathlib import Path

import psycopg2
import psycopg2.extras

import config

CLASSE_CAIXA = 0  # única classe do modelo: "caixa"
VAL_SPLIT = 0.2


def _conectar():
    return psycopg2.connect(**config.DB)


def _buscar_conferencias_pendentes(limite=500):
    conn = _conectar()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, url_imagem_local, quantidade_contada,
                       caixas_por_camada, deteccoes_ia
                FROM conferencias
                WHERE status_dataset = 'pendente_treinamento'
                  AND url_imagem_local IS NOT NULL
                ORDER BY created_at ASC
                LIMIT %s
                """,
                (limite,),
            )
            return cur.fetchall()
    finally:
        conn.close()


def _gerar_label(deteccoes_ia, caixas_por_camada) -> str:
    """
    Gera o conteúdo do arquivo .txt YOLO para as caixas da camada frontal.

    Prioriza `deteccoes_ia` (JSONB com boxes normalizadas 0–1). Na ausência,
    retorna vazio (sem labels reais o detector não treina).
    """
    if not deteccoes_ia:
        return ""

    caixas = deteccoes_ia
    if isinstance(caixas, str):
        caixas = json.loads(caixas)

    if not caixas:
        return ""

    linhas = []
    for caixa in caixas:
        x_center = caixa.get("x_center", 0.0)
        y_center = caixa.get("y_center", 0.0)
        width = caixa.get("width", 0.0)
        height = caixa.get("height", 0.0)
        linhas.append(
            f"{CLASSE_CAIXA} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}"
        )
    return "\n".join(linhas)


def build(limite=500):
    """
    Executa a montagem do dataset.

    Returns:
        list[str]: IDs das conferências efetivamente incluídas (usadas
        depois por train.py para marcá-las como "treinado" caso o novo
        modelo seja aprovado).
    """
    config.TRAIN_DIR.mkdir(parents=True, exist_ok=True)
    config.VAL_DIR.mkdir(parents=True, exist_ok=True)

    conferencias = _buscar_conferencias_pendentes(limite)
    ids_incluidas = []

    for conf in conferencias:
        origem = config.DATASET_PATH / conf["url_imagem_local"]
        if not origem.exists():
            print(f"[build_dataset] imagem ausente, ignorando: {origem}")
            continue

        label_txt = _gerar_label(conf["deteccoes_ia"], conf["caixas_por_camada"])
        if not label_txt:
            print(f"[build_dataset] sem detecções IA para conferência {conf['id']}, ignorando.")
            continue

        destino_dir = config.VAL_DIR if random.random() < VAL_SPLIT else config.TRAIN_DIR
        nome_base = origem.stem
        destino_img = destino_dir / origem.name
        destino_label = destino_dir / f"{nome_base}.txt"

        shutil.copy2(origem, destino_img)
        destino_label.write_text(label_txt, encoding="utf-8")

        ids_incluidas.append(conf["id"])

    _escrever_data_yaml()

    print(f"[build_dataset] {len(ids_incluidas)} conferências incluídas no dataset.")
    return ids_incluidas


def _escrever_data_yaml():
    data_yaml = config.DATASET_PATH / "data.yaml"
    conteudo = (
        f"train: {config.TRAIN_DIR}\n"
        f"val: {config.VAL_DIR}\n"
        "nc: 1\n"
        "names: ['caixa']\n"
    )
    data_yaml.write_text(conteudo, encoding="utf-8")


if __name__ == "__main__":
    build()
