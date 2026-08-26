SELECT 
    a.nome AS "Armazém", 
    p.nome AS "Produto", 
    s.descricao AS "Descrição SKU",
    s.sku AS "Código SKU",
    COALESCE(SUM(m.quantidade), 0) AS "Quantidade Disponível" 
FROM movimentacoes_estoque m 
JOIN armazens a ON m.armazem_id = a.id 
JOIN skus s ON m.sku_id = s.id 
JOIN produtos p ON s.produto_id = p.id 
GROUP BY 
    a.nome, 
    p.nome, 
    s.descricao,
    s.sku
HAVING COALESCE(SUM(m.quantidade), 0) > 0 
ORDER BY 
    a.nome ASC, 
    p.nome ASC;