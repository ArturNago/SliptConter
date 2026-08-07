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

### 🐳 Backend (API + Banco de Dados)

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

### 📱 App Mobile (Expo)

O app mobile **não** roda dentro do `docker-compose` — é um processo separado (Metro Bundler) que você inicia na sua máquina de desenvolvimento. Ele fala com a API via `EXPO_PUBLIC_API_URL`: em produção isso é a URL do túnel Cloudflare; em desenvolvimento local pode ser o IP da própria máquina na rede.

#### Pré-requisitos

| Ferramenta | Versão mínima | Como verificar |
|---|---|---|
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| Expo CLI | global, via `npx expo` | `npx expo --version` |
| Docker + Docker Compose | para o backend + PostgreSQL | `docker-compose -v` |
| Expo Go (app) | Android ou iOS | Baixar na loja de apps do celular |

> **Nota:** `expo` é executado via `npx`, então não precisa ser instalado globalmente — `npx expo start` já funciona após `npm install` no diretório do app.

#### Configuração do ambiente de desenvolvimento

```bash
cd mobile-app

# Instalar dependências (só na primeira vez ou após alterar package.json)
npm install

# Copiar o arquivo de exemplo de variáveis de ambiente do app
cp .env.example .env
```

O arquivo `.env` define a URL da API. O arquivo `.env.local` (não versionado) define o IP do Metro Bundler para a rede local.

##### Variáveis de ambiente relevantes

| Arquivo | Variável | Para que serve |
|---|---|---|
| `mobile-app/.env` | `EXPO_PUBLIC_API_URL` | URL da API que o app vai chamar (túnel Cloudflare em produção, ou `http://<IP-da-máquina>:3000` em dev local na mesma rede) |
| `mobile-app/.env.local` *(não versionado)* | `REACT_NATIVE_PACKAGER_HOSTNAME` | Força o Metro Bundler a anunciar um IP específico da rede local para o Expo Go no celular — necessário quando a máquina tem várias interfaces de rede (Docker, VirtualBox, WSL, VPN) e o Expo detectaria automaticamente o IP errado |

##### Como descobrir o IP correto da sua máquina

No Windows (PowerShell):

```powershell
ipconfig | findstr "IPv4"
```

Procure o IP do adaptador **Wi-Fi** ou **Ethernet** real (ex.: `192.168.1.200`). **Ignore** adaptadores virtuais como Docker, VirtualBox, WSL, Hyper-V ou VPN — eles não alcançam o celular na mesma rede física.

Crie ou edite `mobile-app/.env.local` com esse IP:

```
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.200
```

> O arquivo `.env.local` já existe no repositório com o IP `192.168.1.200`. Se o seu IP mudar (DHCP), atualize-o lá.

#### Rodando o Metro Bundler (modo de teste no Expo Go)

O comando que inicia o servidor de desenvolvimento e disponibiliza o QR code para o Expo Go:

```powershell
cd mobile-app

# Define o IP do Metro Bundler para a rede local (sobrescreve .env.local se necessário)
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "192.168.1.200"

# Limpa o cache do Metro e inicia o bundler
npx expo start --clear
```

Saída esperada no terminal:

```
env: load .env.local .env
env: export EXPO_PUBLIC_API_URL
Starting project at C:\Codigos\SliptConter\mobile-app
```

Com o Metro no ar, o terminal exibe um **QR code** e três opções de tecla:

| Tecla | O que faz |
|---|---|
| `a` | Abre o app no emulador Android (se configurado) |
| `i` | Abre o app no simulador iOS (macOS only) |
| `w` | Abre a versão web no navegador |

##### Como testar no Expo Go (celular físico)

1. **Instale o Expo Go** no celular (Android: Google Play / iOS: App Store).
2. **Conecte o celular e a máquina de desenvolvimento na mesma rede Wi-Fi.**
3. **Escaneie o QR code** exibido no terminal Metro com a câmera do celular (abre automaticamente no Expo Go).
   - Ou abra o app Expo Go manualmente → toque em **"Carregar projeto"** → escaneie o QR code.
4. O app carrega e você vê a tela de login. Use as credenciais do admin padrão:
   - **Usuário:** `Artur` / **Senha:** `9241`

> ⚠️ **O celular não conecta?** Confirme que ambos estão na mesma rede Wi-Fi, que o Firewall do Windows libera o Node.js pela porta 8081 (Metro) para redes privadas, e que `REACT_NATIVE_PACKAGER_HOSTNAME` aponta para o IP do adaptador Wi-Fi/Ethernet real — não para um adaptador virtual (Docker, VirtualBox, WSL).

> ⚠️ **Tela branca ou erro de rede no app?** O Metro Bundler pode ter travado. Pressione `r` no terminal para recarregar, ou `a` para abrir no emulador e testar sem o celular.

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