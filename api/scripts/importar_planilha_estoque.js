const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Pool } = require('pg');
require('dotenv').config();

const ARQUIVO_CSV = path.join(__dirname, 'dados.csv'); // Coloque a planilha aqui

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'tebarrot',
  password: process.env.POSTGRES_PASSWORD || 'tebarrot',
  database: process.env.POSTGRES_DB || 'tebarrot_estoque',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
});

async function importar() {
  console.log('Iniciando importação da planilha...');

  const results = [];

  // 1. Ler o CSV
  fs.createReadStream(ARQUIVO_CSV)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      console.log(`CSV lido com sucesso. Total de linhas: ${results.length}`);

      const client = await pool.connect();
      let ok = true;

      try {
        await client.query('BEGIN');

        // Busca o ID do usuário "admin" ou "sistema" para registrar as movimentações
        const { rows: userRows } = await client.query('SELECT id FROM usuarios LIMIT 1');
        const idOperador = userRows.length > 0 ? userRows[0].id : null;

        if (!idOperador) {
          console.warn('Nenhum usuário encontrado para registrar movimentações. As movimentações podem falhar se a FK for NOT NULL.');
        }

        // Cache de armazéns e produtos genéricos
        const armazensMap = {};
        let idProdutoGenerico = null;

        for (const row of results) {
          const skuStr = row['SKU'];
          const titulo = row['Título'] || row['Titulo'];
          const armazemNome = row['Armazém'] || row['Armazem'];
          const estoqueAtualStr = row['Estoque Atual'];
          const custoMedioStr = row['Custo Médio'] || row['Custo Medio'];

          if (!skuStr || !titulo) continue;

          const estoqueAtual = parseInt(estoqueAtualStr) || 0;
          let custoMedio = 0;

          if (custoMedioStr) {
            custoMedio = parseFloat(custoMedioStr.replace(/\./g, '').replace(',', '.')) || 0;
          }

          // Resolução de Armazém
          let armazemId = null;
          if (armazemNome) {
            if (!armazensMap[armazemNome]) {
              // Tenta buscar no banco
              let resArm = await client.query('SELECT id FROM armazens WHERE nome = $1', [armazemNome]);
              if (resArm.rows.length === 0) {
                // Cria o armazém
                resArm = await client.query('INSERT INTO armazens (nome) VALUES ($1) RETURNING id', [armazemNome]);
              }
              armazensMap[armazemNome] = resArm.rows[0].id;
            }
            armazemId = armazensMap[armazemNome];
          }

          // Lógica de agrupamento de Produto Pai vs SKU
          let nomeProdutoPai = titulo;
          let corSku = null;

          if (titulo.startsWith('Cor:')) {
            corSku = titulo.replace('Cor:', '').trim();
            nomeProdutoPai = 'Produto Genérico Importado'; // Agrupador genérico

            if (!idProdutoGenerico) {
              const resProd = await client.query(
                'INSERT INTO produtos (nome, categoria) VALUES ($1, $2) RETURNING id',
                [nomeProdutoPai, 'Genéricos']
              );
              idProdutoGenerico = resProd.rows[0].id;
            }
          }

          let produtoId = null;

          if (nomeProdutoPai === 'Produto Genérico Importado') {
           produtoId = idProdutoGenerico;
          } else {
           // Cria um produto pai para este item (se já não existir com este exato nome)
           const resProd = await client.query('SELECT id FROM produtos WHERE nome = $1 LIMIT 1', [nomeProdutoPai]);
           if (resProd.rows.length > 0) {
             produtoId = resProd.rows[0].id;
           } else {
             const insertProd = await client.query(
               'INSERT INTO produtos (nome) VALUES ($1) RETURNING id',
               [nomeProdutoPai]
             );
             produtoId = insertProd.rows[0].id;
           }
          }

          // Inserir SKU
          // Verifica se SKU já existe
          const resSku = await client.query('SELECT id FROM skus WHERE sku = $1', [skuStr]);
          let skuId;

          if (resSku.rows.length === 0) {
             const insertSku = await client.query(
               `INSERT INTO skus (produto_id, sku, descricao, cor, custo_medio, volumes_por_camada)
                VALUES ($1, $2, $3, $4, $5, 1) RETURNING id`,
               [produtoId, skuStr, titulo, corSku, custoMedio]
             );
             skuId = insertSku.rows[0].id;
          } else {
             skuId = resSku.rows[0].id;
             // Opcional: Atualizar custo_medio
             await client.query('UPDATE skus SET custo_medio = $1 WHERE id = $2', [custoMedio, skuId]);
          }

          // Registrar Saldo em movimentacoes_estoque se houver estoque > 0
          if (estoqueAtual > 0 && idOperador && armazemId) {
             // Verifica saldo atual para não duplicar se rodar duas vezes
             const resSaldo = await client.query(
               'SELECT COALESCE(SUM(quantidade), 0) as saldo FROM movimentacoes_estoque WHERE sku_id = $1 AND armazem_id = $2',
               [skuId, armazemId]
             );
             const saldo = parseInt(resSaldo.rows[0].saldo) || 0;

             if (saldo < estoqueAtual) {
               const diferenca = estoqueAtual - saldo;
               await client.query(
                 `INSERT INTO movimentacoes_estoque (sku_id, armazem_id, tipo, quantidade, id_operador, observacao)
                  VALUES ($1, $2, 'entrada', $3, $4, 'Importação de Saldo Inicial')`,
                 [skuId, armazemId, diferenca, idOperador]
               );
             }
          }
        }

        await client.query('COMMIT');
        console.log('Importação concluída com sucesso!');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro durante a importação. Transação revertida.', err);
        ok = false;
      } finally {
        client.release();
        await pool.end();
      }

      // Sinaliza erro ao wrapper: exit code != 0 em caso de falha.
      process.exitCode = ok ? 0 : 1;
    });
}

importar();
