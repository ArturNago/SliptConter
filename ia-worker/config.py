"""
Configuração centralizada do worker de IA (V1).
Nenhum outro módulo deve ler `os.environ` diretamente.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None or value == "":
        return default
    return value.lower() == "true"


DATASET_PATH = Path(os.getenv("DATASET_PATH", "/dataset"))
INBOUND_DIR = DATASET_PATH / "inbound"
TRAIN_DIR = DATASET_PATH / "images" / "train"
VAL_DIR = DATASET_PATH / "images" / "val"

MODELS_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODELS_DIR / "best.pt"
CANDIDATE_MODEL_PATH = MODELS_DIR / "candidate.pt"

DB = {
    "user": os.getenv("POSTGRES_USER", "tebarrot"),
    "password": os.getenv("POSTGRES_PASSWORD", "tebarrot"),
    "dbname": os.getenv("POSTGRES_DB", "tebarrot_estoque"),
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": os.getenv("POSTGRES_PORT", "5432"),
}

# Confiança mínima para considerar uma predição válida (abaixo disso,
# o worker retorna "sem sugestão" e o app cai para contagem manual).
CONFIDENCE_THRESHOLD = float(os.getenv("IA_CONFIDENCE_THRESHOLD", "0.5"))

# Margem mínima de melhoria exigida do candidato para promovê-lo a produção.
MIN_IMPROVEMENT = float(os.getenv("IA_MIN_IMPROVEMENT", "0.0"))
