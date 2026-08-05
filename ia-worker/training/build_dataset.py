"""
Monta as pastas train/val a partir do banco (doc, seção 5.6, passos 1-3).

Fonte da verdade: tabela `conferencias`, filtrando
`status_dataset = 'pendente_treinamento'`. Cada conferência confirmada
gera:
  - uma imagem copiada de /dataset/inbound para /dataset/images/{train,val}
  - um arquivo de label YOLO (.txt) com uma caixa por camada confirmada

Heurística de geração de labels
--------------------------------
O app captura a foto sempre com o mesmo overlay-guia fixo (ângulo/distância
padronizados — doc, seção 5.2), então a pilha ocupa uma faixa vertical
previsível do quadro. Cada camada confirmada é aproximada por uma faixa
horizontal de altura igual a 1/N (N = número de camadas), ocupando a
largura útil do quadro. Essa heurística é o ponto de partida do dataset;
como o app já salva `camadas_informadas` confirmado por um humano, o
modelo aprende a localizar essas faixas e melhora a cada ciclo de retreino
conforme mais dados reais entram.
"""
import random
import shutil
from pathlib import Path

import psycopg2
import psycopg2.extras

import config

CLASSE_CAMADA = 0  # única classe do modelo: "camada"
VAL_SPLIT = 0.2

# Faixa útil do quadro ocupada pela pilha (o restante é margem do overlay-guia).
FAIXA_UTIL_Y_INICIO = 0.05
FAIXA_UTIL_Y_FIM = 0.95
FAIXA_UTIL_X_INICIO = 0.15
FAIXA_UTIL_X_FIM = 0.85


def _conectar():
    return psycopg2.connect(**config.DB)


def _buscar_conferencias_pendentes(limite=500):
    conn = _conectar()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, url_imagem_local, camadas_informadas
                FROM conferencias
                WHERE status_dataset = 'pendente_treinamento'
                ORDER BY created_at ASC
                LIMIT %s
                """,
                (limite,),
            )
            return cur.fetchall()
    finally:
        conn.close()


def _gerar_label(camadas_informadas: int) -> str:
    """Gera o conteúdo do arquivo .txt YOLO para N camadas confirmadas."""
    if camadas_informadas <= 0:
        return ""

    altura_faixa = (FAIXA_UTIL_Y_FIM - FAIXA_UTIL_Y_INICIO) / camadas_informadas
    largura_box = FAIXA_UTIL_X_FIM - FAIXA_UTIL_X_INICIO
    x_center = (FAIXA_UTIL_X_INICIO + FAIXA_UTIL_X_FIM) / 2

    linhas = []
    for i in range(camadas_informadas):
        y_center = FAIXA_UTIL_Y_INICIO + altura_faixa * (i + 0.5)
        linhas.append(
            f"{CLASSE_CAMADA} {x_center:.6f} {y_center:.6f} {largura_box:.6f} {altura_faixa:.6f}"
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

        destino_dir = config.VAL_DIR if random.random() < VAL_SPLIT else config.TRAIN_DIR
        nome_base = origem.stem
        destino_img = destino_dir / origem.name
        destino_label = destino_dir / f"{nome_base}.txt"

        shutil.copy2(origem, destino_img)
        destino_label.write_text(_gerar_label(conf["camadas_informadas"]), encoding="utf-8")

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
        "names: ['camada']\n"
    )
    data_yaml.write_text(conteudo, encoding="utf-8")


if __name__ == "__main__":
    build()
