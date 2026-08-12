# Documentação: Fluxo de Mapeamento de SKUs e Sincronização de Vendas

Este documento serve como um guia definitivo para o processo de baixa de estoque e mapeamento de SKUs entre a plataforma Upseller e o ERP Tebarrot (SupraSys). Ele contém o workflow consolidado e explica as razões arquiteturais e os conceitos chaves do sistema.

---

## 1. Contexto e Conceitos Fundamentais

Durante o desenvolvimento da integração, identificamos um desafio comum em operações de e-commerce e indústria: a divergência de códigos de produto.

### O "SKU Upseller" (SKU de Venda / Anúncio)
- **O que é:** O código do produto cadastrado na plataforma Upseller (ou marketplaces como Mercado Livre, Shopee).
- **Características:** Geralmente criado pelo lojista na hora de montar o anúncio. Nem sempre possui um padrão rígido (pode ser "862", "1316", etc.). Muitas vezes as variações (cor, tamanho) não têm um código limpo.
- **Problema:** A fábrica (Tebarrot) não entende esse código.

### O "SKU Tebarrot" (SKU Interno ERP)
- **O que é:** O código oficial do produto cadastrado no banco de dados Firebird (SupraSys) do ERP Tebarrot pelo Fernando.
- **Características:** Segue o padrão de formatação rígido da indústria (ex: `SA3N710135`, `SA3N710011`). É ele quem dita a baixa real no estoque, os lotes e os processos de conferência no armazém.
- **Regra de Ouro:** *O código interno da Tebarrot é imutável.* Ele não pode ser alterado para combinar com o Upseller.

### O Ponto de Conexão: "A Planilha Deus" (`PLANILHA_TODOS_ANUNCIOS.xlsx`)
Como não podemos mudar o SKU da Tebarrot, e não é viável alterar milhares de anúncios no Upseller, criamos a tabela de **Mapeamento (De-Para)**.
Esta planilha age como um "Dicionário" que ensina ao banco de dados do sistema (Postgres) quem é quem.
- Se o Upseller vender o item `1316` (Amêndoa)...
- O sistema olha a Planilha Deus e entende: "Ah, o `1316` significa baixar o SKU Tebarrot `SA3N710135`!"

### Como o Painel Administrativo lê a Planilha de Vendas?
O código foi refatorado para ler a planilha de vendas extraída do Upseller através do **NOME EXATO DAS COLUNAS** do cabeçalho (ex: `SKU` e `Qtd. do Produto`), ignorando completamente a ordem em que elas aparecem. Isso garante total resiliência a futuras mudanças de formato.

---

## 2. O Workflow de Cadastro de Novos SKUs

Quando você realiza a sincronização diária das vendas pelo Web Admin e o sistema acusa **"SKUs Não Mapeados"**, significa que o e-commerce vendeu um código que a "Planilha Deus" ainda não conhece.

Siga exatamente o fluxo abaixo para resolver:

### Passo 1: Extrair os Itens Não Mapeados
Sempre que houver itens não mapeados, o sistema acusará no painel (mas eles não gerarão a baixa do estoque). Se precisar de uma lista, você pode extraí-los da planilha de vendas focando naqueles que o sistema rejeitou.
*No caso prático que fizemos no dia 12/08/2026, eu gerei o arquivo temporário `Itens_Para_Mapear.xlsx` contendo apenas os 8 itens não identificados.*

### Passo 2: Descobrir o SKU Oficial (Tebarrot)
Você precisa saber a tradução exata do SKU Upseller para o SKU da Fábrica.
1. Peça ao Fernando para rodar o script SQL oficial (`api/SQL/exportacao_catalogo_tebarrot.sql`) no banco de dados ERP (Firebird).
2. Ele lhe enviará a tabela Mestra contendo todos os produtos ativos e seus códigos oficiais (`SA3N...`).

### Passo 3: Atualizar a "Planilha Deus"
1. Abra a sua planilha oficial de mapeamento (`c:\Codigos\SliptConter\api\PLANILHA_TODOS_ANUNCIOS.xlsx`).
2. Vá até a última linha em branco.
3. Insira as novas relações. Exemplo:
   - Na coluna referente ao SKU Upseller: `1316`
   - Na coluna referente ao SKU Tebarrot (Destino): `SA3N710135`
   - Preencha Nome e Variação para sua organização.
4. Salve o arquivo.

### Passo 4: Ensinar os novos SKUs ao Banco de Dados
Com a "Planilha Deus" devidamente salva e atualizada com as novas traduções, execute o comando de importação no terminal do seu servidor:
\`\`\`bash
docker exec tebarrot-api node scripts/importar_todos_anuncios.js PLANILHA_TODOS_ANUNCIOS.xlsx
\`\`\`
O sistema processará a planilha e atualizará a tabela interna `mapeamento_anuncios_sku` de forma definitiva.

### Passo 5: Reprocessar as Vendas
Com o banco de dados ensinado, você pode voltar ao **Painel Web Administrativo**.
1. Vá na aba de Movimentações.
2. Clique no botão **Sincronizar Vendas (Planilha)**.
3. Faça o upload **da MESMA planilha do Upseller** que havia sido enviada anteriormente.
4. **Pronto!** O sistema agora reconhecerá os SKUs, registrará o débito (saída) e aparecerão 0 erros de mapeamento para aqueles itens.

*(Nota: Pedidos que já tiveram a baixa registrada de forma bem-sucedida anteriormente teriam a baixa replicada caso o mesmo arquivo exato fosse enviado. Na sua operação real diária, isso não é problema, pois o arquivo do Upseller fechará o consolidado do dia).*

---

## 3. Resumo de Diretrizes
- **Mantenha a segurança:** Nunca conecte este sistema diretamente de forma gravável ao banco do Fernando para evitar impactos na operação da fábrica.
- **Soberania do ERP:** O ERP da Tebarrot dita as regras dos nomes de lote e SKUs. Nós apenas mapeamos.
- **Organização da Planilha:** Trate a `PLANILHA_TODOS_ANUNCIOS.xlsx` como ouro. Faça backups regulares. Se o servidor cair ou o banco resetar, ela será capaz de recriar todas as relações instantaneamente através do script de importação.
