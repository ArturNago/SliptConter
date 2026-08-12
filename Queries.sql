
# ==============================================================================
# DASHBOARD EXECUTIVO
# ==============================================================================
SELECT 
    COUNT(DISTINCT ES09.PEDIDO) AS TOTAL_PEDIDOS,
    SUM(ES09.VTOTAL) AS RECEITA_TOTAL,
    SUM(ES09.VTOTAL - COALESCE(ES09.VR_CUSTO, 0)) AS MARGEM_LUCRO,
    AVG(ES09.VTOTAL) AS TICKET_MEDIO_ITEM,
    SUM(ES09.VTOTAL) / NULLIF(COUNT(DISTINCT ES09.PEDIDO), 0) AS TICKET_MEDIO_PEDIDO
FROM 
    ARQES09 ES09
INNER JOIN 
    ARQES13 ES13 ON ES09.PEDIDO = ES13.PEDIDO
WHERE 
    ES13.SITU <> 'C'  -- Excluir pedidos cancelados
    AND ES13.DENTR IS NOT NULL  -- Pedidos entregues
;

# ==============================================================================
# QUERIES DE LOGÍSTICA - ANÁLISE DE CARGAS E EXPEDIÇÃO
# ==============================================================================

# ------------------------------------------------------------------------------
# QUERY 1: DIAGNÓSTICO DE PRODUTOS POR CARGA
# ------------------------------------------------------------------------------
QUERY_DIAGNOSTICO_CARGA = """
/*
=============================================================================
DIAGNÓSTICO DE PRODUTOS EM CARGA ESPECÍFICA
=============================================================================

DESCRIÇÃO:
    Query de diagnóstico para verificar produtos carregados em uma carga
    específica e validar o relacionamento entre pedidos e produtos tipo VOL.

TABELAS UTILIZADAS:
    - VD_CARGA: Cabeçalho das cargas/expedições
    - ARQES07: Pedidos vinculados à carga
    - ARQES09: Itens dos pedidos
    - ARQES01: Cadastro de produtos (peso, volume, unidade)

INFORMAÇÕES RETORNADAS:
    ✓ Código do produto (com cor e tamanho)
    ✓ Quantidade embarcada
    ✓ Dados cadastrais (nome, unidade, peso bruto, volume)
    ✓ Status de validação (encontrado, unidade correta, etc.)

UTILIZAÇÃO:
    - Diagnóstico de cargas específicas
    - Validação de produtos tipo VOL
    - Troubleshooting de inconsistências

PARÂMETRO OBRIGATÓRIO:
    - VC.NROCARGA = [número da carga] (substituir na cláusula WHERE)

ÚLTIMA ATUALIZAÇÃO: 2025-11-27
TIPO: Query de diagnóstico/validação
=============================================================================
*/

SELECT 
    ES09.PRODUTO AS COD_PRODUTO,
    ES09.COD_COR,
    ES09.COD_TAMANHO,
    ES09.QTDE AS QUANTIDADE_EMBARCADA,
    ES01."CODIGO" AS COD_CADASTRO,
    ES01.NOME AS DESCRICAO_PRODUTO,
    ES01.UNID AS UNIDADE,
    ES01.PBRUTO AS PESO_BRUTO_UNIT_KG,
    ES01.VOLUME_MT3 AS VOLUME_UNIT_M3,
    CASE 
        WHEN ES01."CODIGO" IS NULL THEN 'PRODUTO NÃO ENCONTRADO'
        WHEN ES01.UNID <> 'VOL' THEN 'UNID DIFERENTE DE VOL'
        ELSE 'OK'
    END AS STATUS_VALIDACAO
FROM 
    VD_CARGA VC
INNER JOIN 
    ARQES07 PED 
        ON PED.SEQCARGA = VC.SEQCARGA
INNER JOIN 
    ARQES09 ES09 
        ON ES09.PEDIDO = PED.PEDIDO
LEFT JOIN 
    ARQES01 ES01 
        ON ES01."CODIGO" = ES09.PRODUTO
       AND ES01.COD_COR = ES09.COD_COR
       AND ES01.COD_TAMANHO = ES09.COD_TAMANHO
WHERE 
    VC.NROCARGA = ?  -- Substituir pelo número da carga desejada
ORDER BY 
    ES09.PRODUTO;
"""

# ------------------------------------------------------------------------------
# QUERY 2: RELATÓRIO CONSOLIDADO DE CARGAS (PRODUÇÃO)
# ------------------------------------------------------------------------------
QUERY_RELATORIO_CARGAS = """
/*
=============================================================================
RELATÓRIO CONSOLIDADO DE CARGAS - ANÁLISE LOGÍSTICA
=============================================================================

DESCRIÇÃO:
    Relatório gerencial de cargas/expedições com totalizadores de peso,
    volume e quantidade de produtos tipo VOL (volumes) transportados.

TABELAS UTILIZADAS:
    - VD_CARGA: Cabeçalho das cargas (data, situação, transportadora)
    - ARQES07: Pedidos vinculados à carga (via SEQCARGA)
    - ARQES09: Itens dos pedidos (produtos e quantidades)
    - ARQES01: Cadastro de produtos (peso bruto/líquido, volume unitário)
    - ARQCAD: Cadastro de transportadoras

INFORMAÇÕES RETORNADAS:
    ✓ Identificação da carga (código, data, situação)
    ✓ Transportadora responsável
    ✓ Quantidade de produtos distintos
    ✓ Quantidade total de volumes (soma das unidades)
    ✓ Peso bruto total em KG (quantidade × peso bruto unitário)
    ✓ Peso líquido total em KG (quantidade × peso líquido unitário)
    ✓ Volume total em m³ (quantidade × volume unitário)

FILTROS APLICADOS:
    - Apenas produtos com UNID = 'VOL' (volumes de móveis)
    - Últimos 90 dias de cargas
    
AGREGAÇÃO:
    - GROUP BY: carga, data, situação, transportadora
    - Totalizadores: SUM() para quantidades, pesos e volumes

ORDENAÇÃO:
    - Data da carga (mais recente primeiro)

IMPORTANTE:
    ✓ Utiliza PBRUTO e PLIQUI para cálculo correto de peso
    ✓ VOLUME_MT3 contém o volume unitário em metros cúbicos
    ✓ Relacionamento validado: VD_CARGA → ARQES07 → ARQES09 → ARQES01

ÚLTIMA ATUALIZAÇÃO: 2025-11-27
VALIDADO: Sim - Query testada com carga 22479 (299.88 kg, 0.76 m³)
TIPO: Query de produção
=============================================================================
*/

SELECT 
    VC.NROCARGA AS CODIGO_CARGA,
    VC."DATA" AS DATA_CARGA,
    VC.SITUACAO AS SITUACAO_CARGA,
    TRANSP.NOME AS NOME_TRANSPORTADORA,
    
    -- Quantidade de produtos e volumes
    COUNT(DISTINCT ES09.PRODUTO) AS QTD_PRODUTOS_DISTINTOS,
    SUM(COALESCE(ES09.QTDE, 0)) AS QTD_TOTAL_VOLUMES,
    
    -- Peso total BRUTO (quantidade × peso bruto unitário)
    SUM(COALESCE(ES09.QTDE, 0) * COALESCE(ES01.PBRUTO, 0)) AS PESO_BRUTO_TOTAL_KG,
    
    -- Peso total LÍQUIDO (quantidade × peso líquido unitário)
    SUM(COALESCE(ES09.QTDE, 0) * COALESCE(ES01.PLIQUI, 0)) AS PESO_LIQUIDO_TOTAL_KG,
    
    -- Volume total em m³ (quantidade × volume unitário)
    SUM(COALESCE(ES09.QTDE, 0) * COALESCE(ES01.VOLUME_MT3, 0)) AS VOLUME_TOTAL_M3
    
FROM 
    VD_CARGA VC
INNER JOIN 
    ARQES07 PED
        ON PED.SEQCARGA = VC.SEQCARGA
INNER JOIN 
    ARQES09 ES09
        ON ES09.PEDIDO = PED.PEDIDO
INNER JOIN
    ARQES01 ES01
        ON ES01."CODIGO" = ES09.PRODUTO
       AND ES01.COD_COR = ES09.COD_COR
       AND ES01.COD_TAMANHO = ES09.COD_TAMANHO
       AND ES01.UNID = 'VOL'  -- Apenas volumes (móveis embalados)
LEFT JOIN 
    ARQCAD TRANSP 
        ON TRANSP."TIPOC" = VC.TIPO_TRANSP
       AND TRANSP.CODIC = VC.COD_TRANSP
WHERE 
    VC."DATA" >= CURRENT_DATE - 90  -- Últimos 90 dias
GROUP BY 
    VC.NROCARGA, 
    VC."DATA", 
    VC.SITUACAO, 
    TRANSP.NOME
ORDER BY 
    VC."DATA" DESC;
"""

# ==============================================================================
# NOTAS DE IMPLEMENTAÇÃO
# ==============================================================================
# 
# RELACIONAMENTO DAS TABELAS (descoberto através de análise):
# 
# VD_CARGA (cargas/expedições)
#     ↓ (via SEQCARGA)
# ARQES07 (pedidos de venda vinculados à carga)
#     ↓ (via PEDIDO)
# ARQES09 (itens dos pedidos - produtos e quantidades)
#     ↓ (via PRODUTO + COD_COR + COD_TAMANHO)
# ARQES01 (cadastro de produtos - peso, volume, características)
#
# CAMPOS-CHAVE PARA PESO E VOLUME:
# - PBRUTO: Peso bruto unitário em KG (campo correto para logística)
# - PLIQUI: Peso líquido unitário em KG
# - VOLUME_MT3: Volume unitário em metros cúbicos (m³)
# - PESO_PECA: Campo legado, não usar (valor padrão 1 kg)
#
# VALIDAÇÃO REALIZADA:
# - Carga 22479: 9 volumes, 299.88 kg, 0.76 m³ ✓ (validado com ERP)
# ==============================================================================




QUERY_RELATORIO_VENDAS = """
/*
=============================================================================
RELATÓRIO DETALHADO DE VENDAS
=============================================================================

DESCRIÇÃO:
    Consulta completa de pedidos de venda com informações comerciais, 
    financeiras e logísticas para análise gerencial.

TABELAS UTILIZADAS:
    - ARQES07: Cabeçalho dos pedidos (cliente, vendedor, valores totais)
    - ARQES09: Itens dos pedidos (produtos, quantidades, valores unitários)
    - ARQCAD: Cadastro de clientes e vendedores
    - ARQES01: Cadastro de produtos (unidade, características)
    - CIDADES: Informações de localização dos clientes

INFORMAÇÕES RETORNADAS:
    ✓ Dados do pedido (código, datas, status, valor total)
    ✓ Cliente completo (código, nome, fantasia, cidade, UF)
    ✓ Vendedor responsável (código, nome)
    ✓ Itens detalhados (produto, descrição, quantidade, valores)
    ✓ Análise de margem (custo, margem R$, margem %, margem contribuição)
    ✓ Informações logísticas (peso bruto/líquido, código carga, local estoque)

FILTROS APLICADOS:
    - Exclui pedidos cancelados (STATUS <> 'C')
    - Últimos 90 dias de vendas
    
ORDENAÇÃO:
    - Data do pedido (mais recente primeiro)
    - Código do pedido
    - Número sequencial do item

ÚLTIMA ATUALIZAÇÃO: 2025-11-27
VALIDADO: Sim - Query testada e funcional em produção
=============================================================================
*/

SELECT 
    -- Informações do Pedido
    PED.PEDIDO AS CODIGO_PEDIDO,
    PED.DATA AS DATA_PEDIDO,
    PED.DTAENTREGA AS DATA_ENTREGA,
    PED.SITUACAO AS STATUS_PEDIDO,
    PED.TOTAL AS VALOR_TOTAL_PEDIDO,
    
    -- Informações do Cliente
    CLI.CODIC AS COD_CLIENTE,
    CLI.NOME AS NOME_CLIENTE,
    CLI.NFANTASIA AS NOME_FANTASIA_CLIENTE,
    CID.NOME AS CIDADE_CLIENTE,
    CLI.ESTA AS UF_CLIENTE,
    
    -- Informações do Vendedor
    VEND.CODIC AS COD_VENDEDOR,
    VEND.NOME AS NOME_VENDEDOR,
    
    -- Informações do Item
    IT.ITEM AS NUM_ITEM,
    IT.PRODUTO AS COD_PRODUTO,
    IT.NOME AS DESCRICAO_PRODUTO,
    PROD.UNID AS UNIDADE_PRODUTO,
    IT.QTDE AS QUANTIDADE,
    IT.VUNIT AS VALOR_UNITARIO,
    IT.VTOTAL AS VALOR_TOTAL_ITEM,
    IT.VR_DESC AS VALOR_DESCONTO,
    IT.VTOTAL_LIQ AS VALOR_LIQUIDO_ITEM,
    
    -- Custos e Margem
    IT.VR_CUSTO AS CUSTO_UNITARIO,
    (IT.QTDE * IT.VR_CUSTO) AS CUSTO_TOTAL_ITEM,
    (IT.VTOTAL - (IT.QTDE * COALESCE(IT.VR_CUSTO, 0))) AS MARGEM_ITEM,
    IT.VR_MARG_CONTRIBUICAO AS MARGEM_CONTRIBUICAO,
    IT.PERC_MARG_CONTRIBUICAO AS PERC_MARGEM_CONTRIBUICAO,
    
    -- Percentual de Margem Calculado
    CASE 
        WHEN IT.VTOTAL > 0 THEN 
            ((IT.VTOTAL - (IT.QTDE * COALESCE(IT.VR_CUSTO, 0))) / IT.VTOTAL) * 100
        ELSE 0 
    END AS PERCENTUAL_MARGEM,
    
    -- Informações Complementares
    IT.PESO_BRUTO AS PESO_BRUTO_KG,
    IT.PESO_LIQUIDO AS PESO_LIQUIDO_KG,
    PED.SEQCARGA AS CODIGO_CARGA,
    IT.CODLOCAL AS LOCAL_ESTOQUE
    
FROM 
    ARQES07 PED
INNER JOIN 
    ARQES09 IT 
        ON IT.PEDIDO = PED.PEDIDO
LEFT JOIN 
    ARQCAD CLI 
        ON CLI.CODIC = PED.CODIC 
       AND CLI."TIPOC" = PED.TIPOC
LEFT JOIN 
    ARQCAD VEND 
        ON VEND.CODIC = PED.CODIV
       AND VEND."TIPOC" = PED.TIPOV
LEFT JOIN
    ARQES01 PROD
        ON PROD."CODIGO" = IT.PRODUTO
       AND PROD.COD_COR = IT.COD_COR
       AND PROD.COD_TAMANHO = IT.COD_TAMANHO
LEFT JOIN
    CIDADES CID
        ON CID.SEQCIDADE = CLI.SEQCIDADE
WHERE 
    PED.SITUACAO <> 'C'  -- Excluir cancelados
    AND PED.DATA >= CURRENT_DATE - 90  -- Últimos 90 dias
ORDER BY 
    PED.DATA DESC, 
    PED.PEDIDO, 
    IT.ITEM;


"""
# ==============================================================================
# PRODUÇÃO - EFICIÊNCIA
# ==============================================================================

QUERY_PRODUCAO_EFICIENCIA = """
/*
Eficiência de Produção por Máquina
Fonte: PCP_FA_APONTAMENTO (Apontamentos) + PCP_FA_MAQUINA (Cadastro de Máquinas)

Métricas Calculadas:
- Tempo Total de Produção por Máquina
- Quantidade Produzida
- Tempo Médio por Peça
- Taxa de Utilização
*/
SELECT 
    MAQ.CODIGO AS COD_MAQUINA,
    MAQ.DESCRICAO AS NOME_MAQUINA,
    MAQ.SETOR AS SETOR,
    
    -- Métricas de Produção
    COUNT(APON.CODIGO) AS TOTAL_APONTAMENTOS,
    SUM(APON.QUANTIDADE) AS QTD_PRODUZIDA,
    SUM(APON.TEMPO_PRODUCAO) AS TEMPO_TOTAL_MINUTOS,
    
    -- Tempo Médio por Peça (em minutos)
    SUM(APON.TEMPO_PRODUCAO) / NULLIF(SUM(APON.QUANTIDADE), 0) AS TEMPO_MEDIO_POR_PECA,
    
    -- Eficiência (assumindo 480 minutos por dia útil - 8h)
    (SUM(APON.TEMPO_PRODUCAO) / (COUNT(DISTINCT APON.DATA_APONTAMENTO) * 480.0)) * 100 AS TAXA_UTILIZACAO_PERCENTUAL,
    
    -- Data do último apontamento
    MAX(APON.DATA_APONTAMENTO) AS ULTIMO_APONTAMENTO
FROM 
    PCP_FA_MAQUINA MAQ
LEFT JOIN 
    PCP_FA_APONTAMENTO APON ON MAQ.CODIGO = APON.COD_MAQUINA
WHERE 
    APON.DATA_APONTAMENTO >= DATEADD(-30 DAY TO CURRENT_DATE)  -- Últimos 30 dias
GROUP BY 
    MAQ.CODIGO, MAQ.DESCRICAO, MAQ.SETOR
ORDER BY 
    QTD_PRODUZIDA DESC
"""

QUERY_PRODUCAO_POR_PERIODO = """
/*
Produção Detalhada por Período
Permite análise temporal da produção
Parâmetros: :data_inicio, :data_fim
*/
SELECT 
    APON.DATA_APONTAMENTO AS DATA,
    MAQ.DESCRICAO AS MAQUINA,
    MAQ.SETOR AS SETOR,
    APON.COD_PRODUTO AS CODIGO_PRODUTO,
    APON.QUANTIDADE AS QTD_PRODUZIDA,
    APON.TEMPO_PRODUCAO AS TEMPO_MINUTOS,
    APON.OPERADOR AS OPERADOR
FROM 
    PCP_FA_APONTAMENTO APON
INNER JOIN 
    PCP_FA_MAQUINA MAQ ON APON.COD_MAQUINA = MAQ.CODIGO
WHERE 
    APON.DATA_APONTAMENTO BETWEEN ? AND ?
ORDER BY 
    APON.DATA_APONTAMENTO DESC, MAQ.DESCRICAO
"""

# ==============================================================================
# QUERIES AUXILIARES
# ==============================================================================

QUERY_CLIENTES_ATIVOS = """
/*
=============================================================================
CLIENTES ATIVOS - ANÁLISE DE BASE DE CLIENTES
=============================================================================

DESCRIÇÃO:
    Listagem de clientes ativos com histórico de compras, mostrando
    volume de pedidos, faturamento total e análise de engajamento.

TABELAS UTILIZADAS:
    - ARQCAD: Cadastro de clientes (dados cadastrais e localização)
    - ARQES07: Pedidos de venda (cabeçalho)
    - ARQES09: Itens dos pedidos (valores e quantidades)
    - CIDADES: Informações de localização (nome da cidade)

INFORMAÇÕES RETORNADAS:
    ✓ Identificação do cliente (código, nome, fantasia)
    ✓ Localização (cidade e UF)
    ✓ Documento (CNPJ/CPF)
    ✓ Quantidade total de pedidos realizados
    ✓ Valor total de compras (R$)
    ✓ Ticket médio por pedido (R$)
    ✓ Data do último pedido
    ✓ Frequência de compra (dias entre pedidos)

DEFINIÇÃO DE "CLIENTE ATIVO":
    - Realizou pelo menos 1 pedido nos últimos 6 meses (180 dias)
    - Pedido não cancelado (STATUS <> 'C')

PERÍODO DE ANÁLISE:
    - Últimos 6 meses (180 dias)

ORDENAÇÃO:
    - Valor total de compras (maior para menor)

MÉTRICAS-CHAVE:
    - TOTAL_PEDIDOS: Quantidade de pedidos do cliente no período
    - TOTAL_COMPRAS: Faturamento total gerado pelo cliente
    - TICKET_MEDIO: Valor médio por pedido
    - ULTIMO_PEDIDO: Data do pedido mais recente

ÚLTIMA ATUALIZAÇÃO: 2025-11-27
VALIDADO: Sim - Query testada e funcional
TIPO: Query analítica/CRM
=============================================================================
*/

SELECT 
    CLI.CODIC AS COD_CLIENTE,
    CLI.NOME AS NOME_CLIENTE,
    CLI.NFANTASIA AS NOME_FANTASIA,
    CID.NOME AS CIDADE,
    CLI.ESTA AS UF,
    CLI.NCGC AS CNPJ,
    CLI.NCPF AS CPF,
    
    -- Métricas de atividade
    COUNT(DISTINCT PED.PEDIDO) AS TOTAL_PEDIDOS,
    MAX(PED.DATA) AS DATA_ULTIMO_PEDIDO,
    MIN(PED.DATA) AS DATA_PRIMEIRO_PEDIDO,
    
    -- Métricas financeiras
    SUM(IT.VTOTAL) AS TOTAL_COMPRAS,
    AVG(IT.VTOTAL) AS TICKET_MEDIO_ITEM,
    SUM(IT.VTOTAL) / COUNT(DISTINCT PED.PEDIDO) AS TICKET_MEDIO_PEDIDO,
    
    -- Análise de frequência
    CASE 
        WHEN COUNT(DISTINCT PED.PEDIDO) > 1 THEN
            DATEDIFF(DAY, MIN(PED.DATA), MAX(PED.DATA)) / (COUNT(DISTINCT PED.PEDIDO) - 1)
        ELSE NULL
    END AS DIAS_ENTRE_PEDIDOS,
    
    -- Dados de contato
    CLI.EMAIL AS EMAIL,
    CLI.FONE1 AS TELEFONE
    
FROM 
    ARQCAD CLI
INNER JOIN 
    ARQES07 PED 
        ON PED.CODIC = CLI.CODIC 
       AND PED.TIPOC = CLI."TIPOC"
INNER JOIN 
    ARQES09 IT 
        ON IT.PEDIDO = PED.PEDIDO
LEFT JOIN
    CIDADES CID
        ON CID.SEQCIDADE = CLI.SEQCIDADE
WHERE 
    CLI."TIPOC" = 'C'  -- Apenas clientes
    AND PED.DATA >= CURRENT_DATE - 180  -- Últimos 6 meses
    AND PED.SITUACAO <> 'C'  -- Exclui cancelados
GROUP BY 
    CLI.CODIC,
    CLI.NOME,
    CLI.NFANTASIA,
    CID.NOME,
    CLI.ESTA,
    CLI.NCGC,
    CLI.NCPF,
    CLI.EMAIL,
    CLI.FONE1
ORDER BY 
    TOTAL_COMPRAS DESC;
"""


# ==============================================================================
# VARIAÇÕES DA QUERY - ANÁLISES SEGMENTADAS
# ==============================================================================

QUERY_CLIENTES_INATIVOS = """
/*
Clientes Inativos - Sem Compras Recentes
Identifica clientes que não compraram nos últimos 6 meses mas têm histórico
*/

SELECT 
    CLI.CODIC AS COD_CLIENTE,
    CLI.NOME AS NOME_CLIENTE,
    CLI.NFANTASIA AS NOME_FANTASIA,
    CID.NOME AS CIDADE,
    CLI.ESTA AS UF,
    
    -- Última compra (fora do período de 6 meses)
    MAX(PED.DATA) AS DATA_ULTIMA_COMPRA,
    DATEDIFF(DAY, MAX(PED.DATA), CURRENT_DATE) AS DIAS_SEM_COMPRAR,
    
    -- Histórico total
    COUNT(DISTINCT PED.PEDIDO) AS TOTAL_PEDIDOS_HISTORICO,
    SUM(IT.VTOTAL) AS TOTAL_COMPRAS_HISTORICO
    
FROM 
    ARQCAD CLI
INNER JOIN 
    ARQES07 PED 
        ON PED.CODIC = CLI.CODIC 
       AND PED.TIPOC = CLI."TIPOC"
INNER JOIN 
    ARQES09 IT 
        ON IT.PEDIDO = PED.PEDIDO
LEFT JOIN
    CIDADES CID
        ON CID.SEQCIDADE = CLI.SEQCIDADE
WHERE 
    CLI."TIPOC" = 'C'
    AND PED.SITUACAO <> 'C'
    AND CLI.CODIC NOT IN (
        -- Exclui clientes que compraram nos últimos 6 meses
        SELECT DISTINCT P.CODIC 
        FROM ARQES07 P 
        WHERE P.DATA >= CURRENT_DATE - 180
          AND P.SITUACAO <> 'C'
    )
GROUP BY 
    CLI.CODIC,
    CLI.NOME,
    CLI.NFANTASIA,
    CID.NOME,
    CLI.ESTA
HAVING
    MAX(PED.DATA) >= CURRENT_DATE - 365  -- Comprou no último ano
ORDER BY 
    DATA_ULTIMA_COMPRA DESC;
"""


QUERY_CLIENTES_VIP = """
/*
Clientes VIP - Top Clientes por Faturamento
Clientes mais importantes nos últimos 6 meses
*/

SELECT FIRST 100
    CLI.CODIC AS COD_CLIENTE,
    CLI.NOME AS NOME_CLIENTE,
    CLI.NFANTASIA AS NOME_FANTASIA,
    CID.NOME AS CIDADE,
    CLI.ESTA AS UF,
    
    -- Métricas de desempenho
    COUNT(DISTINCT PED.PEDIDO) AS TOTAL_PEDIDOS,
    SUM(IT.VTOTAL) AS TOTAL_COMPRAS,
    AVG(IT.VTOTAL) AS TICKET_MEDIO,
    MAX(PED.DATA) AS DATA_ULTIMO_PEDIDO,
    
    -- Classificação
    CASE 
        WHEN SUM(IT.VTOTAL) >= 100000 THEN 'VIP PLATINUM'
        WHEN SUM(IT.VTOTAL) >= 50000 THEN 'VIP GOLD'
        WHEN SUM(IT.VTOTAL) >= 20000 THEN 'VIP SILVER'
        ELSE 'VIP'
    END AS CATEGORIA_VIP,
    
    -- Dados de contato
    CLI.EMAIL,
    CLI.FONE1 AS TELEFONE
    
FROM 
    ARQCAD CLI
INNER JOIN 
    ARQES07 PED 
        ON PED.CODIC = CLI.CODIC 
       AND PED.TIPOC = CLI."TIPOC"
INNER JOIN 
    ARQES09 IT 
        ON IT.PEDIDO = PED.PEDIDO
LEFT JOIN
    CIDADES CID
        ON CID.SEQCIDADE = CLI.SEQCIDADE
WHERE 
    CLI."TIPOC" = 'C'
    AND PED.DATA >= CURRENT_DATE - 180
    AND PED.SITUACAO <> 'C'
GROUP BY 
    CLI.CODIC,
    CLI.NOME,
    CLI.NFANTASIA,
    CID.NOME,
    CLI.ESTA,
    CLI.EMAIL,
    CLI.FONE1
HAVING
    SUM(IT.VTOTAL) >= 10000  -- Mínimo R$ 10.000 no período
ORDER BY 
    TOTAL_COMPRAS DESC;
"""


QUERY_NOVOS_CLIENTES = """
/*
Novos Clientes - Primeira Compra nos Últimos 6 Meses
Análise de captação de novos clientes
*/

SELECT 
    CLI.CODIC AS COD_CLIENTE,
    CLI.NOME AS NOME_CLIENTE,
    CLI.NFANTASIA AS NOME_FANTASIA,
    CID.NOME AS CIDADE,
    CLI.ESTA AS UF,
    CLI.DATACAD AS DATA_CADASTRO,
    
    -- Primeira compra
    MIN(PED.DATA) AS DATA_PRIMEIRA_COMPRA,
    DATEDIFF(DAY, CLI.DATACAD, MIN(PED.DATA)) AS DIAS_CADASTRO_ATE_COMPRA,
    
    -- Performance inicial
    COUNT(DISTINCT PED.PEDIDO) AS TOTAL_PEDIDOS,
    SUM(IT.VTOTAL) AS TOTAL_COMPRAS,
    AVG(IT.VTOTAL) AS TICKET_MEDIO
    
FROM 
    ARQCAD CLI
INNER JOIN 
    ARQES07 PED 
        ON PED.CODIC = CLI.CODIC 
       AND PED.TIPOC = CLI."TIPOC"
INNER JOIN 
    ARQES09 IT 
        ON IT.PEDIDO = PED.PEDIDO
LEFT JOIN
    CIDADES CID
        ON CID.SEQCIDADE = CLI.SEQCIDADE
WHERE 
    CLI."TIPOC" = 'C'
    AND PED.SITUACAO <> 'C'
GROUP BY 
    CLI.CODIC,
    CLI.NOME,
    CLI.NFANTASIA,
    CID.NOME,
    CLI.ESTA,
    CLI.DATACAD
HAVING
    MIN(PED.DATA) >= CURRENT_DATE - 180  -- Primeira compra nos últimos 6 meses
ORDER BY 
    DATA_PRIMEIRA_COMPRA DESC;
"""


# ==============================================================================
# GUIA DE USO - ANÁLISE DE CLIENTES
# ==============================================================================
#
# ESCOLHA A QUERY CONFORME O OBJETIVO:
#
# 1. QUERY_CLIENTES_ATIVOS
#    → Para: Análise geral da base ativa, segmentação comercial
#    → Mostra: Todos os clientes com compras recentes (6 meses)
#
# 2. QUERY_CLIENTES_INATIVOS
#    → Para: Ações de reativação, reconquista de clientes
#    → Mostra: Clientes com histórico mas sem compras recentes
#
# 3. QUERY_CLIENTES_VIP
#    → Para: Programas de fidelidade, atendimento diferenciado
#    → Mostra: Top 100 clientes por faturamento com classificação
#
# 4. QUERY_NOVOS_CLIENTES
#    → Para: Análise de captação, efetividade de marketing
#    → Mostra: Clientes que fizeram primeira compra nos últimos 6 meses
#
# PERÍODOS:
# - Clientes Ativos/VIP/Novos: 180 dias (6 meses)
# - Clientes Inativos: entre 6 meses e 1 ano sem comprar
#
# ==============================================================================


QUERY_PRODUTOS_MAIS_VENDIDOS = """
/*
=============================================================================
TOP PRODUTOS MAIS VENDIDOS - ANÁLISE COMERCIAL
=============================================================================

DESCRIÇÃO:
    Ranking dos produtos mais vendidos com análise de desempenho comercial,
    mostrando quantidade de pedidos, volume vendido e receita gerada.

TABELAS UTILIZADAS:
    - ARQES09: Itens dos pedidos (vendas realizadas)
    - ARQES07: Cabeçalho dos pedidos (validação de status)
    - ARQES01: Cadastro de produtos (informações complementares)

INFORMAÇÕES RETORNADAS:
    ✓ Código do produto (SKU)
    ✓ Descrição completa do produto
    ✓ Unidade de medida
    ✓ Quantidade de pedidos distintos
    ✓ Quantidade total vendida
    ✓ Receita total gerada (R$)
    ✓ Preço médio praticado (R$)
    ✓ Margem média de contribuição (%)

PERÍODO DE ANÁLISE:
    - Últimos 3 meses (90 dias)

FILTROS APLICADOS:
    - Exclui pedidos cancelados (STATUS <> 'C')
    - Apenas pedidos dos últimos 90 dias

ORDENAÇÃO:
    - Quantidade vendida (maior para menor)

LIMITE:
    - Top 50 produtos

MÉTRICAS-CHAVE:
    - QTD_PEDIDOS: Quantidade de pedidos distintos (penetração)
    - QTD_VENDIDA: Volume total comercializado
    - RECEITA_TOTAL: Faturamento total do produto
    - PRECO_MEDIO: Ticket médio do produto

ÚLTIMA ATUALIZAÇÃO: 2025-11-27
VALIDADO: Sim - Query testada e funcional
TIPO: Query analítica/gerencial
=============================================================================
*/

SELECT FIRST 50
    IT.PRODUTO AS COD_PRODUTO,
    IT.NOME AS DESCRICAO_PRODUTO,
    PROD.UNID AS UNIDADE,
    
    -- Métricas de penetração e volume
    COUNT(DISTINCT IT.PEDIDO) AS QTD_PEDIDOS_DISTINTOS,
    SUM(IT.QTDE) AS QTD_TOTAL_VENDIDA,
    
    -- Métricas financeiras
    SUM(IT.VTOTAL) AS RECEITA_TOTAL,
    AVG(IT.VUNIT) AS PRECO_MEDIO,
    SUM(IT.VTOTAL_LIQ) AS RECEITA_LIQUIDA,
    
    -- Análise de margem
    AVG(IT.PERC_MARG_CONTRIBUICAO) AS MARGEM_MEDIA_PERC,
    SUM(IT.VR_MARG_CONTRIBUICAO) AS MARGEM_TOTAL_RS,
    
    -- Informações complementares
    SUM(IT.PESO_BRUTO * IT.QTDE) AS PESO_TOTAL_VENDIDO_KG
    
FROM 
    ARQES09 IT
INNER JOIN 
    ARQES07 PED 
        ON PED.PEDIDO = IT.PEDIDO
LEFT JOIN
    ARQES01 PROD
        ON PROD."CODIGO" = IT.PRODUTO
       AND PROD.COD_COR = IT.COD_COR
       AND PROD.COD_TAMANHO = IT.COD_TAMANHO
WHERE 
    PED.SITUACAO <> 'C'  -- Exclui cancelados
    AND PED.DATA >= CURRENT_DATE - 90  -- Últimos 3 meses (90 dias)
GROUP BY 
    IT.PRODUTO, 
    IT.NOME,
    PROD.UNID
ORDER BY 
    QTD_TOTAL_VENDIDA DESC;
"""


# ==============================================================================
# VARIAÇÕES DA QUERY - ANÁLISES COMPLEMENTARES
# ==============================================================================

QUERY_PRODUTOS_MAIS_RENTAVEIS = """
/*
Top Produtos Mais Rentáveis (por Margem Total em R$)
Mesma estrutura, ordenação diferente
*/

SELECT FIRST 50
    IT.PRODUTO AS COD_PRODUTO,
    IT.NOME AS DESCRICAO_PRODUTO,
    COUNT(DISTINCT IT.PEDIDO) AS QTD_PEDIDOS,
    SUM(IT.QTDE) AS QTD_VENDIDA,
    SUM(IT.VTOTAL) AS RECEITA_TOTAL,
    SUM(IT.VR_MARG_CONTRIBUICAO) AS MARGEM_TOTAL_RS,
    AVG(IT.PERC_MARG_CONTRIBUICAO) AS MARGEM_MEDIA_PERC
FROM 
    ARQES09 IT
INNER JOIN 
    ARQES07 PED 
        ON PED.PEDIDO = IT.PEDIDO
WHERE 
    PED.SITUACAO <> 'C'
    AND PED.DATA >= CURRENT_DATE - 90
GROUP BY 
    IT.PRODUTO, 
    IT.NOME
ORDER BY 
    MARGEM_TOTAL_RS DESC;  -- Ordena por rentabilidade
"""


QUERY_PRODUTOS_MAIOR_TICKET = """
/*
Top Produtos com Maior Ticket Médio
Identifica produtos premium/alto valor agregado
*/

SELECT FIRST 50
    IT.PRODUTO AS COD_PRODUTO,
    IT.NOME AS DESCRICAO_PRODUTO,
    COUNT(DISTINCT IT.PEDIDO) AS QTD_PEDIDOS,
    SUM(IT.QTDE) AS QTD_VENDIDA,
    AVG(IT.VUNIT) AS PRECO_MEDIO,
    SUM(IT.VTOTAL) AS RECEITA_TOTAL
FROM 
    ARQES09 IT
INNER JOIN 
    ARQES07 PED 
        ON PED.PEDIDO = IT.PEDIDO
WHERE 
    PED.SITUACAO <> 'C'
    AND PED.DATA >= CURRENT_DATE - 90
    AND IT.QTDE > 0  -- Evita divisões por zero
GROUP BY 
    IT.PRODUTO, 
    IT.NOME
HAVING 
    SUM(IT.QTDE) >= 5  -- Mínimo 5 unidades vendidas (relevância estatística)
ORDER BY 
    PRECO_MEDIO DESC;  -- Ordena por ticket médio
"""


# ==============================================================================
# NOTAS DE USO
# ==============================================================================
#
# ESCOLHA A QUERY CONFORME O OBJETIVO:
#
# 1. QUERY_PRODUTOS_MAIS_VENDIDOS
#    → Para: Gestão de estoque, planejamento de produção
#    → Critério: Volume (quantidade vendida)
#
# 2. QUERY_PRODUTOS_MAIS_RENTAVEIS
#    → Para: Análise financeira, foco em margem
#    → Critério: Rentabilidade (margem em R$)
#
# 3. QUERY_PRODUTOS_MAIOR_TICKET
#    → Para: Estratégia comercial, produtos premium
#    → Critério: Valor unitário (preço médio)
#
# PERÍODO PADRÃO: 90 dias (ajustável alterando "CURRENT_DATE - 90")
#
# ==============================================================================


# ==============================================================================
# DICIONÁRIO DE QUERIES
# ==============================================================================

QUERIES = {
    'dashboard_executivo': QUERY_DASHBOARD_EXECUTIVO,
    'dashboard_logistica': QUERY_DASHBOARD_LOGISTICA,
    'volumes_por_carga': QUERY_VOLUMES_POR_CARGA,
    'relatorio_vendas': QUERY_RELATORIO_VENDAS,
    'vendas_por_periodo': QUERY_VENDAS_POR_PERIODO,
    'producao_eficiencia': QUERY_PRODUCAO_EFICIENCIA,
    'producao_por_periodo': QUERY_PRODUCAO_POR_PERIODO,
    'clientes_ativos': QUERY_CLIENTES_ATIVOS,
    'produtos_mais_vendidos': QUERY_PRODUTOS_MAIS_VENDIDOS,
}
