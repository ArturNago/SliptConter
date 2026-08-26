-- Migration 022: Cadastro e padronização dos 4 armazéns físicos (2 Tebarrot + 2 MRI Loja)
INSERT INTO armazens (nome, codigo, ativo)
VALUES 
  ('Tebarrot - Galpão Principal (Fábrica/CD)', 'TEBARROT_CD', TRUE),
  ('Tebarrot - Expedição E-commerce (Dezzign Decor)', 'TEBARROT_EXP', TRUE),
  ('MRI Loja - Estoque Físico Loja', 'MRI_LOJA', TRUE),
  ('MRI Loja - Expedição Marketplaces (MLDM)', 'MRI_EXP', TRUE)
ON CONFLICT (codigo) DO UPDATE 
SET nome = EXCLUDED.nome, ativo = TRUE;
