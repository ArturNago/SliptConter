Para iniciar o serviço de IA, você tem duas opções dependendo de como prefere rodá-lo (via Docker ou direto no Windows):

### Opção 1: Via Docker (Recomendado)
Como o projeto está usando Docker, o ideal é rodar o container do worker para que ele fique na mesma rede da API e do Banco de Dados.

Abra o terminal (PowerShell ou CMD), navegue até a pasta do projeto e execute o comando usando o profile `v1` (que libera a inicialização da IA):

```powershell
cd C:\Codigos\SliptConter
docker-compose --profile v1 up -d --build ia-worker
```
*(O `--build` garante que ele pegará todas as alterações que fizemos, como o novo threshold de 0.25 e o modelo melhorado).*

---

### Opção 2: Rodando Nativamente (Fora do Docker)
Se você preferir rodar a IA direto no Windows para debugar mais facilmente no terminal (como parecia estar ocorrendo antes na porta 8000), basta rodar o servidor FastAPI diretamente:

```powershell
cd C:\Codigos\SliptConter\ia-worker
python -m uvicorn app:app --host 0.0.0.0 --port 8000
```
> **Aviso:** Lembre-se que, se você optar por rodar fora do Docker, a sua `tebarrot-api` (que roda no Docker) não conseguirá enxergar a IA a menos que você ajuste no seu `.env` a variável `IA_WORKER_URL` para `http://host.docker.internal:8000` para que a API saiba sair do container e procurar a IA no seu Windows.

Se precisar de ajuda para inspecionar os logs do container ou se esbarrar em algum erro ao iniciar, é só avisar!