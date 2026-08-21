# Plano: Fluxo de mapeamento manual de SKUs não sincronizados no admin-web

## Problema atual
- A importação de vendas falha para SKUs não mapeados (`naoMapeados`).
- O admin-web não possui tela de mapeamentos; apenas o mobile-app tem.
- O botão de download da planilha de erros pode não aparecer porque o container `admin-web` está desatualizado.
- O usuário precisa atualizar o app mobile constantemente para corrigir mapeamentos.

## Solução
Adicionar capacidade de mapeamento manual no admin-web e eliminar a dependência do mobile-app para correções.

## Tarefas

### 1. Rebuild do admin-web (imediato)
- Reconstruir a imagem Docker do `admin-web` para aplicar as alterações mais recentes do código (botão de download da planilha).
- Validar que o botão "Baixar planilha de não sincronizados (.xlsx)" aparece quando `naoMapeados > 0`.

### 2. Criar página de Mapeamentos no admin-web
- **Rota já existe**: `GET /api/mapeamentos`, `POST /api/mapeamentos`, etc.
- Criar página `admin-web/src/pages/MappingsPage.jsx` com:
  - Listagem de mapeamentos existentes (nome do anúncio, variação, SKU ERP, SKU do sistema).
  - Busca por texto.
  - Botão "Novo mapeamento".
- Criar modal `MapeamentoFormModal.jsx` reutilizando a lógica do mobile-app:
  - Campos: Nome do Anúncio, Variação (opcional), SKU ERP (opcional), Selecionar SKU do sistema.
  - Lista de SKUs disponíveis para seleção (chamar `GET /api/produtos` ou endpoint de SKUs).
  - Salvar via `POST /api/mapeamentos`.

### 3. Integrar modal de importação com mapeamento inline
- Em `ImportSalesModal.jsx`, na seção de resultado:
  - Se houver `naoMapeados`, listar cada item.
  - Para cada item, adicionar botão "Mapear agora".
  - Ao clicar, abrir modal de mapeamento com `nome_anuncio` e `sku_erp` pré-preenchidos.
  - Após salvar o mapeamento, atualizar o estado local e reprocessar automaticamente os itens que ainda estão sem mapeamento (chamando novamente o backend com os mesmos dados ou atualizando a lista).
- Alternativa mais simples: após salvar o mapeamento, exibir mensagem "Mapeamento salvo. Reimporte a planilha para aplicar." e manter o botão de reimportação no modal.

### 4. Reprocessamento focalizado
- Adicionar endpoint auxiliar no backend ou reutilizar o existente:
  - `POST /api/movimentacoes/reprocessar-nao-mapeados` recebe a lista de `naoMapeados` e tenta processar apenas eles com os mapeamentos atualizados.
  - Ou, mais simples: o frontend reenvia o mesmo arquivo e o backend faz o auto-heal (já existe fallback para SKUs idênticos, mas não para mapeamentos novos).
- Fluxo preferido: após criar um mapeamento manual, o admin-web já reprocessa automaticamente os itens pendentes sem precisar reupload da planilha.

### 5. Validação
- Testar importação com 1 SKU não mapeado.
- Mapear manualmente pelo admin-web.
- Confirmar que o item pendente é processado automaticamente.
- Confirmar que a planilha de download ainda é gerada como fallback.

## Riscos
- O endpoint de listagem de SKUs no backend pode não existir ou ser `GET /api/produtos` com resposta pesada. Verificar viabilidade.
- Reprocessamento automático pode gerar movimentações duplicadas se não for controlado. Deve-se garantir idempotência (usar `numeroPedido` + `sku_id` + `armazem_id` como chave única).

## Pergunta pendente
- O backend possui endpoint específico para listar SKUs de forma leve? Ou devemos usar `GET /api/produtos`?
