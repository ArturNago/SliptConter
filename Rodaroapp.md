### 🛠️ Passos Finais para Validar no Seu Ambiente (Runtime)

Abra o seu terminal na pasta do projeto e execute os comandos abaixo para aplicar o fechamento da migration pendente e subir a API estabilizada:

1. **Aplicar as Migrations e subir o banco/API atualizados:**
```powershell
cd api
npm run migrate

```


2. **Subir os containers atualizados (com rebuild limpo):**
```powershell
docker-compose up -d --build api

```


3. **Testar o app no Mobile com cache limpo:**
Como ajustamos os hooks de listagem e o consumo de dados para evitar o estouro de requisições (`/saldos` agregados), limpe o cache do Expo no seu PC e abra novamente no seu iPhone:
```powershell
cd ../mobile-app
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "192.168.1.200"
npx expo start --clear

```


