/*
=============================================================================
EXTRAÇÃO DE CATÁLOGO MESTRE (PRODUTOS, ETIQUETAS E LOTES)
=============================================================================
Banco de Dados: Firebird (SupraSys/SicNet)
Tabela Alvo: ARQES01 (Cadastro de Produtos)

Este script foi gerado para exportar de forma segura o catálogo de produtos
da base oficial. O resultado dessa query deve ser salvo como CSV (.csv) 
e enviado para a equipe de tecnologia para atualização das etiquetas.

ATENÇÃO FERNANDO:
Caso o campo de Código de Barras e Lote tenham nomes diferentes no seu 
sistema, por favor, ajuste os campos "CODBARRAS" e "LOTE" na query abaixo 
para os nomes corretos utilizados na sua versão do SupraSys.
=============================================================================
*/

SELECT 
    TRIM(P."CODIGO") AS SKU_TEBARROT,
    TRIM(P.NOME) AS NOME_PRODUTO,
    
    -- Se o sistema usa grade de cor/tamanho, trazemos também
    TRIM(COALESCE(P.COD_COR, '')) AS COR,
    TRIM(COALESCE(P.COD_TAMANHO, '')) AS TAMANHO,
    
    -- Campos que precisamos mapear (Ajustar nomes se necessário)
    TRIM(COALESCE(P.CODBARRAS, '')) AS CODIGO_BARRAS_EAN,
    TRIM(COALESCE(P.LOTE, '')) AS LOTE_PRODUCAO,
    
    -- Informações extras úteis para conferência
    P.PBRUTO AS PESO_KG,
    P.VOLUME_MT3 AS VOLUME_M3
    
FROM 
    ARQES01 P
WHERE 
    P.UNID = 'VOL' -- Apenas volumes (móveis embalados), conforme sua regra logística
ORDER BY 
    P."CODIGO";
