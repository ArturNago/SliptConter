# Plano: Contagem semi-automática de estoque com YOLOv12 (detecção frente+camadas)

## Contexto

O SliptConter já prevê uma V1 de IA, mas a implementação está incompleta:
- `ia-worker` (FastAPI + YOLOv8 **atual**, migrando para **YOLOv12**) existe, porém `models/best.pt` **não está treinado** (só `.gitkeep`) e sobe só no profile `v1`. `ultralytics==8.2.31` (sem suporte a v12).
- O endpoint `POST /api/conferencias/sugestao-ia` e o `api.solicitarSugestaoIA()` no app **já existem**, mas `LancarContagemScreen.js` é 100% manual e nunca os chama.
- `ia-worker/training/build_dataset.py` está **defasado**: ainda consulta a coluna `camadas_informadas`, renomeada para `quantidade_contada` pela migration `011`.
- O modelo atual (classe `camada`, uma faixa por camada, YOLOv8) é frágil para **caixas idênticas empilhadas**: o detector 2D não enxerga caixas ocluídas atrás/dentro da pilha, então contar cada caixa na foto 2D falha.

### Decisões já alinhadas com o usuário
1. **Inferência no servidor** (`ia-worker`), reaproveitando a infra local. Sem módulos nativos no app.
2. **Estratégia híbrida frente+camadas** (a "forma correta" de usar a ferramenta):
   - YOLOv12 detecta as **caixas da camada frontal visível** (uma classe `caixa`) → `caixasPorCamada`.
   - O operador **confirma o número de camadas** (stepper) no app, com default de uma heurística/per-SKU.
   - **Total = `caixasPorCamada` × `camadas`**.
   - O `OverlayGuide` (enquadramento fixo ~1,5m, frente) garante que a frente fique 100% visível e sem oclusão mútua → elimina a confusão de caixas iguais.
3. **Pós-captura com overlay**: após tirar a foto, a IA devolve caixas + sugestão; o app desenha as caixas sobre a foto e o operador confirma/ajusta.
4. **OCR fora de escopo** (produto já identificado por barcode/SKU existente).
5. **Modelo YOLOv12** (mais recente da família Ultralytics, atenção-centrada). API Ultralytics idêntica à v8 — só muda o peso (`yolo12n.pt`) e a versão do pacote. Tamanho recomendado: **nano (`yolo12n`)** para inferência CPU no galpão; `yolo12s` se houver margem de VRAM no treino.

### Por que isso resolve o desafio das caixas iguais empilhadas
Caixas idênticas ocultam umas às outras em profundidade. Em vez de tentar contar o que o detector não vê, restringimos a cena (overlay-guia) e contamos só a **face frontal** — onde as caixas não se sobrepõem — e multiplicamos pelas camadas informadas pelo operador. É robusto, auditável e aproveita o `volumes_por_camada`/`camadas_maximas_palete` por SKU como sanidade.

---

## Escopo de mudanças

### A. `ia-worker` (Python)
- **`inference/predict.py`**: substituir `predict_camadas` por `predict_caixas(image_path)`:
  - Carrega modelo de classe `caixa` (YOLOv12n).
  - Retorna `{ disponivel, modelo_disponivel, caixas:[{x_center,y_center,width,height,conf}], caixas_por_camada:int, confianca:float }` com coords **normalizadas** (0–1) para o overlay do app.
  - `caixas_por_camada` = nº de detecções ≥ `CONFIDENCE_THRESHOLD` (frente). `confianca` = média das confs válidas.
- **`app.py`**: `/predict` retorna o payload acima (mantém `/health`). Atualizar docstring.
- **`config.py`**: manter `CONFIDENCE_THRESHOLD`. Adicionar `CLASSE_CAIXA=0` e caminho de labels.
- **`training/build_dataset.py`** (corrigir + adaptar):
  - Parar de gerar faixas; copiar **labels YOLO reais** (`caixa`) de um diretório de inbound já anotado.
  - `data.yaml` → `nc: 1`, `names: ['caixa']`.
  - Assumir esquema novo: ler `quantidade_contada`/`status_dataset` (não mais `camadas_informadas`).
- **`training/train.py`** / **`validate_model.py`**: treinar/validar detector de `caixa` (base `yolo12n.pt`, imgsz 640, épocas moderadas). `BASE_WEIGHTS="yolo12n.pt"`. Validar candidate → promover a `best.pt`.
- **`requirements.txt`**: subir `ultralytics` para `>=8.3.0` (suporte a YOLOv12; o pin atual `8.2.31` não suporta). `torch` acompanha (CPU por padrão no Dockerfile; treino offsite usa GPU). `flash-attn` opcional (acelera v12, não obrigatório).
- **`Dockerfile`**: sem mudança estrutural — apenas instala o `requirements.txt` atualizado.
- **Anotação (nova etapa obrigatória)**: script/`docs` para rotular ~50–150 fotos reais de pilhas (vista frontal) com bounding boxes por caixa, usando ferramenta offline (Label Studio / labelImg / Roboflow). Gerar `.txt` YOLO em `/dataset/images/{train,val}`. Sem labels reais por caixa, o detector não treina.

### B. `api` (Node/Express)
- **`src/services/iaClient.js`** (`sugerirContagem`): retornar `{ caixas, caixasPorCamada, confianca }` (não só camadas). `null` se desabilitado/indisponível.
- **`src/controllers/conferenciasController.js`** (`sugestaoIA`): devolver `{ disponivel:true, caixas, caixasPorCamada, confianca }`.
- **Migration nova** (ex.: `017_ia_contagem_caixas.sql`):
  - `conferencias`: add `caixas_por_camada INTEGER`, `camadas_confirmadas INTEGER`, `caixas_sugeridas_ia INTEGER`, `deteccoes_ia JSONB` (opcional, para auditoria das boxes).
  - Marcar `status_dataset='pendente_treinamento'` nas conferências com foto para o loop de retreino.
- **`src/models/Sku.js`** / **produtosController**: expor `volumesPorCamada` e `camadasMaximasPalete` no `GET /produtos/:id` (já existem) para o app fazer sanidade.

### C. `mobile-app` (Expo/RN)
- **`src/screens/LancarContagemScreen.js`**:
  - Após `tirarFoto()`, se IA habilitada, chamar `api.solicitarSugestaoIA(imagemUri)`.
  - Se `disponivel:true` → abrir etapa de revisão IA (nova tela/modal) passando `imagemUri`, `caixas`, `caixasPorCamada`, `confianca`, e o SKU (`volumesPorCamada`/`camadasMaximasPalete` para default/sanidade).
  - Se `disponivel:false` → fluxo manual atual.
- **Novo `src/components/DetectionOverlay.js`**: desenha as boxes normalizadas (View absolute posicionado por `%`) sobre a `<Image>` da foto (RN não desenha direto na imagem).
- **Novo `src/screens/ContagemIAReviewScreen.js`** (ou modal):
  - Mostra foto + `DetectionOverlay` (boxes verdes).
  - Exibe `caixasPorCamada` (sugerido) e um **stepper de camadas** (default = `camadasMaximasPalete` do SKU ou 1).
  - Calcula **Total = caixasPorCamada × camadas** em tempo real.
  - Aviso se `caixasPorCamada` desviar muito de `volumesPorCamada` do SKU (sanidade).
  - Operador confirma → `quantidadeContada=total`, `quantidadeSugeridaIa=total`, `origem='ia'`, `caixas_por_camada`, `camadas_confirmadas` enviados em `criarConferencia`.
- **`src/services/api.js`** (`criarConferencia`): aceitar e enviar `caixasPorCamada`, `camadasConfirmadas`, `caixasSugeridasIa` (o `solicitarSugestaoIA` já existe e basta consumir o novo shape).

---

## Ordem de execução (implementation task list)

1. **Dataset & anotação** — rotular fotos reais de pilhas (frontal) com boxes por caixa; gerar `.txt` YOLO (`caixa`) em `/dataset`. *Sem isto, não há modelo.*
2. **Corrigir `build_dataset.py`** para o esquema novo e labels reais de `caixa`.
3. **Treinar** `caixa` detector (base `yolo12n.pt`) → `models/best.pt`; `validate_model.py` antes de promover.
4. **`predict.py` + `app.py`**: endpoint `/predict` retornando `caixas` + `caixas_por_camada` + `confianca`.
5. **`iaClient.js` + `sugestaoIA`**: propagar novo payload.
6. **Migration** da tabela `conferencias` (novas colunas).
7. **App**: `DetectionOverlay`, `ContagemIAReviewScreen`, integrar em `LancarContagemScreen`, estender `criarConferencia`.
8. **Deploy**: subir `ia-worker` no profile `v1`, `IA_WORKER_ENABLED=true`, colocar `best.pt`.

---

## Validação
- **Unitário (ia-worker)**: `predict_caixas` em imagens de teste com frente de N caixas conhecidos → `caixas_por_camada == N`.
- **API**: `POST /sugestao-ia` retorna `caixas` (coords 0–1) e `caixas_por_camada`; com worker off → `{disponivel:false}`.
- **App (Expo Go)**: capturar pilha real → boxes desenhadas sobre a foto; ajustar camadas; Total = caixas×camadas; confirmar → ledger atualizado com `origem='ia'`.
- **Fallback**: desabilitar IA → app cai para manual sem erro.
- **Sanidade**: desvio de `caixasPorCamada` vs `volumesPorCamada` dispara aviso.
- **Retreino**: conferência confirmada vira `pendente_treinamento` e alimenta novo ciclo de dataset.

## Riscos
- **Sem GPU no galpão**: treinar `yolo12n` em máquina à parte (YOLOv12 atenção-centrada prefere VRAM) e copiar `best.pt`; inferência em CPU é aceitável para 1 foto.
- **Esforço de anotação**: mitigado com overlay-guia (caixas em grade regular dentro do quadro facilita label e detecção).
- **Perspectiva/oclusão da frente** se operador não alinhar ao guia → instrução + reforço do `OverlayGuide`.
- **Camadas ainda dependentes do operador** — aceitável para contagem *semi*-automática.

## Perguntas em aberto (confirmar antes de codar B.5/C)
- O servidor do galpão tem GPU ou treinamos em máquina externa e enviamos `best.pt`? **(Recomendado: treinar externo, copiar `best.pt`.)**
- Ferramenta de anotação preferida offline? **(Recomendado: Label Studio ou labelImg, gerando YOLO txt.)**
- Quantas fotos rotular no primeiro lote? **(Recomendado: 50–150 da frente de pilhas reais.)**
