"""
API HTTP do worker de IA (V1), consumida pelo `iaClient.js` da API Node.

Endpoints:
    GET  /health   -> health check simples
    POST /predict   -> recebe a foto da pilha, retorna a sugestão de camadas
"""
import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

import config
from inference.predict import modelo_disponivel, predict_camadas

app = FastAPI(title="Tebarrot IA Worker", version="1.0.0")


@app.get("/health")
def health():
    return {"status": "ok", "modelo_disponivel": modelo_disponivel()}


@app.post("/predict")
async def predict(imagem: UploadFile = File(...)):
    if not modelo_disponivel():
        raise HTTPException(
            status_code=503,
            detail="Modelo ainda não treinado. A API deve seguir no fluxo manual (V0).",
        )

    suffix = Path(imagem.filename or "foto.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(imagem.file, tmp)
        tmp_path = tmp.name

    try:
        resultado = predict_camadas(tmp_path)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    if resultado is None:
        raise HTTPException(status_code=503, detail="Modelo indisponível.")

    return JSONResponse(resultado)
