# 📦 SliptConter — Sistema de Conferência de Estoque

![Status](https://img.shields.io/badge/status-v0%20production-brightgreen)
![Docker](https://img.shields.io/badge/Docker-Compose-blue)
![Node.js](https://img.shields.io/badge/Node.js-Express-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)

Sistema de conferência e controle de estoque via **visão computacional**, rodando **100% em infraestrutura local** (sem custos de nuvem), com **acesso mobile remoto seguro** para os operadores do galpão.

---

## 🏗️ Arquitetura

| Camada | Tecnologia | Função |
|---|---|---|
| 🐧 **Servidor** | Ubuntu Server | Máquina local no galpão |
| 📦 **Orquestração** | Docker + Docker Compose | Sobre todos os serviços juntos |
| 🔙 **Backend** | Node.js (Express) | Regras de negócio, auth, sync |
| 🗄️ **Banco de Dados** | PostgreSQL | Fonte única da verdade |
| 🖼️ **Armazenamento** | Volume local Docker | Fotos e dataset |
| 🤖 **IA (V1)** | Python + YOLOv8 | Sugestão de contagem de camadas |
| 🌐 **Túnel** | Cloudflare Tunnel + Access | Acesso remoto HTTPS seguro |
| 📱 **Mobile** | React Native (Expo) | App do operador |
| 📊 **Espelho** | Google Sheets | Leitura assíncrona para gestão |

---

## 🚀 Funcionalidades

- ✅ **Login rápido** — por crachá (QR) ou PIN fallback
- 📸 **Captura com overlay-guia** — foto padronizada de cada pilha
- 🔢 **Contagem manual (V0)** — operador informa camadas
- 🤖 **Contagem assistida por IA (V1)** — YOLOv8 sugere o número de camadas
- 📋 **Ledger imutável** — toda movimentação registrada com auditoria
- 📶 **Sync offline → online** — fila SQLite no celular, sincroniza quando online
- 📊 **Espelho Google Sheets** — atualização assíncrona para a gestão
- 🔒 **Acesso remoto seguro** — Cloudflare Tunnel + Cloudflare Access (autenticação obrigatória)

---

## 📁 Estrutura do Projeto

```
SliptConter/
├── docker-compose.yml
├── .env                          # sensível — não versionado
├── .env.example
├── api/                          # Backend Node.js
│   ├── src/
│   │   ├── config/               # db, cloudflare, sheets
│   │   ├── controllers/          # lógica de cada rota
│   │   ├── routes/               # definição dos endpoints
│   │   ├── services/             # ledger, sheets, ia client
│   │   ├── models/               # definição das tabelas
│   │   ├── middlewares/          # auth, validação
│   │   └── app.js
│   ├── migrations/               # schema SQL
│   ├── Dockerfile
│   └── package.json
├── ia-worker/                    # Serviço Python (V1)
│   ├── inference/predict.py      # inferência YOLOv8
│   ├── training/train.py         # fine-tuning
│   ├── training/build_dataset.py # monta train/val
│   ├── training/validate_model.py # valida novo modelo
│   ├── Dockerfile
│   └── requirements.txt
├── mobile-app/                   # React Native (Expo)
│   ├── src/
│   │   ├── screens/              # Login, Home, Captura, etc.
│   │   ├── services/             # API, SQLite, sync
│   │   └── components/
│   └── package.json
├── docs/
│   └── Documentacao_de_Arquitetura_e_Engenharia_v3.md
└── README.md
```

---

## 🔄 Roadmap

| Fase | Status | Descrição |
|---|---|---|
| **V0** | ✅ Em produção | Contagem manual, sem IA, gerando dataset real |
| **V1** | 🔜 Planejado | YOLOv8 assistindo a contagem, treinado com imagens da V0 |

---

## 🛠️ Como Rodar

```bash
# Clone o repositório
git clone git@github.com:ArturNago/SliptConter.git
cd SliptConter

# Copie o arquivo de exemplo de variáveis de ambiente
cp .env.example .env

# Edite o .env com seus valores reais
# (POSTGRES_PASSWORD, JWT_SECRET, credenciais Google, etc.)

# Suba todos os serviços
docker-compose up -d
```

---

## 🔐 Segurança

- 🔑 Credenciais nunca versionadas — use `.env.example` como template
- 🌐 Acesso remoto exige autenticação obrigatória via Cloudflare Access
- 📱 Dados sensíveis trafegam apenas via HTTPS (túnel Cloudflare)
- 🗄️ O PostgreSQL é a fonte única da verdade — Google Sheets é apenas espelho de leitura

---

## 📄 Licença

Este projeto é privado e de uso interno.

---

> Feito com 💪 para o time do galpão — Tebarrot