
## Fase 2: Performance e Desinchaço Concluída
- O Puppeteer e o Chromium foram totalmente removidos da imagem Docker da API.
- A geração do PDF foi recriada de forma nativa utilizando a biblioteca leve *pdfkit*. O novo relatório PDF é renderizado de forma puramente vetorial e tabular em frações de segundos, poupando mais de 1GB de RAM do seu servidor.

## Fase 3: Arquitetura Avançada (Em progresso)
- **Monorepo (Turborepo) implementado!** Todo o código (pi, dmin-web, mobile-app, ia-worker) foi migrado para a nova estrutura de pastas organizadas dentro de /apps/. O arquivo docker-compose.yml e as rotinas de build foram ajustadas para esse novo layout corporativo.
