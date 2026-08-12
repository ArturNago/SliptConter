const { Pool } = require('pg');
const env = require('./env');
const fs = require('fs');
const path = require('path');

const mockFilePath = path.join(__dirname, 'db_mock.json');

let useMock = process.env.USE_MOCK_DB === 'true';
let pool = null;

if (!useMock) {
  try {
    pool = new Pool({
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      host: env.db.host,
      port: env.db.port,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  } catch (err) {
    console.warn('[db] Falha ao inicializar o pool do PG, usando banco mockado.', err.message);
    useMock = true;
  }
}

function readMockDb() {
  try {
    const data = fs.readFileSync(mockFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('[db mock] Erro ao ler db_mock.json:', err.message);
    return { usuarios: [], produtos: [], skus: [], armazens: [], conferencias: [], movimentacoes_estoque: [], sheets_sync_queue: [] };
  }
}

function writeMockDb(dbData) {
  try {
    fs.writeFileSync(mockFilePath, JSON.stringify(dbData, null, 2), 'utf8');
  } catch (err) {
    console.error('[db mock] Erro ao escrever db_mock.json:', err.message);
  }
}

function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function mockQuery(text, params = []) {
  const dbData = readMockDb();
  const sql = text.replace(/\s+/g, ' ').trim();
  let rows = [];
  let mutated = false;

  try {
    if (sql === 'SELECT 1') {
      return { rows: [{ '?column?': 1 }] };
    }

    // Interceptor 1: dashboardMetrics - totalSkusAtivos, totalPecasEstoque, valorTotalEstoque
    if (sql.includes('COUNT(DISTINCT s.id)') && sql.includes('valorTotalEstoque')) {
      const activeSkus = dbData.skus.filter(s => s.ativo === true);
      let totalPecasEstoque = 0;
      let valorTotalEstoque = 0;
      
      activeSkus.forEach(s => {
        const moves = dbData.movimentacoes_estoque.filter(m => m.sku_id === s.id);
        const qty = moves.reduce((sum, m) => sum + parseInt(m.quantidade || 0, 10), 0);
        totalPecasEstoque += qty;
        valorTotalEstoque += qty * parseFloat(s.custo_medio || 0);
      });

      return {
        rows: [{
          totalSkusAtivos: activeSkus.length,
          totalPecasEstoque: totalPecasEstoque,
          valorTotalEstoque: valorTotalEstoque
        }]
      };
    }

    // Interceptor 2: dashboardMetrics - conferenciasHoje
    if (sql.includes('COUNT(*)::int AS "conferenciasHoje"')) {
      const todayStr = new Date().toISOString().split('T')[0];
      const count = dbData.conferencias.filter(c => {
        const cDate = new Date(c.created_at).toISOString().split('T')[0];
        return cDate === todayStr;
      }).length;
      return {
        rows: [{
          conferenciasHoje: count
        }]
      };
    }

    // Interceptor 3: dashboardMetrics - totalArmazens
    if (sql.includes('COUNT(*)::int AS "totalArmazens"')) {
      const count = dbData.armazens.filter(a => a.ativo === true).length;
      return {
        rows: [{
          totalArmazens: count
        }]
      };
    }

    // Interceptor 4: dashboardMetrics - pendenciasSheets
    if (sql.includes('COUNT(*)::int AS "pendenciasSheets"')) {
      const count = dbData.sheets_sync_queue.filter(q => ['pendente', 'erro'].includes(q.status)).length;
      return {
        rows: [{
          pendenciasSheets: count
        }]
      };
    }

    // Interceptor 5: dashboardMetrics - alertsEstoqueBaixo
    if (sql.includes('COALESCE(SUM(m.quantidade), 0)::int AS saldo') && sql.includes('HAVING COALESCE(SUM(m.quantidade), 0) <= $1')) {
      const threshold = params[0] || 0;
      const activeSkus = dbData.skus.filter(s => s.ativo === true);
      const rows = [];
      activeSkus.forEach(s => {
        const moves = dbData.movimentacoes_estoque.filter(m => m.sku_id === s.id);
        const qty = moves.reduce((sum, m) => sum + parseInt(m.quantidade || 0, 10), 0);
        if (qty <= threshold) {
          rows.push({
            id: s.id,
            sku: s.sku,
            descricao: s.descricao,
            saldo: qty
          });
        }
      });
      rows.sort((a, b) => a.saldo - b.saldo);
      return { rows: rows.slice(0, 50) };
    }

    // Interceptor 6: dashboardMetrics - temporal series
    if (sql.includes('entradas') && sql.includes('saidas') && sql.includes('ajustes') && sql.includes('movimentacoes_estoque')) {
      const groups = {};
      dbData.movimentacoes_estoque.forEach(m => {
        const date = new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (!groups[date]) {
          groups[date] = { data: date, entradas: 0, saidas: 0, ajustes: 0 };
        }
        const qty = Math.abs(parseInt(m.quantidade || 0, 10));
        if (m.tipo === 'entrada') {
          groups[date].entradas += qty;
        } else if (m.tipo === 'saida') {
          groups[date].saidas += qty;
        } else if (m.tipo === 'ajuste') {
          groups[date].ajustes += qty;
        }
      });
      const rows = Object.values(groups).sort((a, b) => a.data.localeCompare(b.data));
      return { rows };
    }

    // Interceptor 7: dashboardMetrics - distribuicaoPorArmazem
    if (sql.includes('distribuicaoPorArmazem') || (sql.includes('armazens a') && sql.includes('COALESCE(SUM(m.quantidade), 0)::int AS saldo'))) {
      const activeArmazens = dbData.armazens.filter(a => a.ativo === true);
      const rows = activeArmazens.map(a => {
        const moves = dbData.movimentacoes_estoque.filter(m => m.armazem_id === a.id);
        const qty = moves.reduce((sum, m) => sum + parseInt(m.quantidade || 0, 10), 0);
        return {
          id: a.id,
          nome: a.nome,
          saldo: qty
        };
      });
      rows.sort((a, b) => b.saldo - a.saldo);
      return { rows };
    }

    // Interceptor 8: dashboardMetrics - distribuicaoPorCategoria
    if (sql.includes('Sem categoria') && sql.includes('COALESCE(SUM(m.quantidade), 0)::int AS saldo')) {
      const activeSkus = dbData.skus.filter(s => s.ativo === true);
      const categoryMap = {};
      activeSkus.forEach(s => {
        const p = dbData.produtos.find(prod => prod.id === s.produto_id) || {};
        const cat = s.categoria || p.categoria || 'Sem categoria';
        
        const moves = dbData.movimentacoes_estoque.filter(m => m.sku_id === s.id);
        const qty = moves.reduce((sum, m) => sum + parseInt(m.quantidade || 0, 10), 0);
        
        categoryMap[cat] = (categoryMap[cat] || 0) + qty;
      });

      const rows = Object.entries(categoryMap).map(([categoria, saldo]) => ({
        categoria,
        saldo
      }));
      rows.sort((a, b) => b.saldo - a.saldo);
      return { rows: rows.slice(0, 15) };
    }

    if (sql.includes('FROM usuarios')) {
      if (sql.includes('WHERE id = $1')) {
        const user = dbData.usuarios.find(u => u.id === params[0]);
        rows = user ? [user] : [];
      } else if (sql.includes('WHERE username = $1 AND ativo = TRUE')) {
        const user = dbData.usuarios.find(u => u.username === params[0] && u.ativo === true);
        rows = user ? [user] : [];
      } else {
        rows = dbData.usuarios;
      }
    } else if (sql.startsWith('INSERT INTO usuarios')) {
      const newUser = {
        id: generateUuid(),
        nome: params[0],
        username: params[1],
        senha: params[2],
        papel: params[3] || 'operador',
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      dbData.usuarios.push(newUser);
      rows = [newUser];
      mutated = true;
    } else if (sql.startsWith('UPDATE usuarios')) {
      const id = params[0];
      const userIndex = dbData.usuarios.findIndex(u => u.id === id);
      if (userIndex !== -1) {
        const user = dbData.usuarios[userIndex];
        if (params[1] !== undefined) user.nome = params[1];
        if (params[2] !== undefined) user.username = params[2];
        if (params[3] !== undefined) user.senha = params[3];
        if (params[4] !== undefined) user.papel = params[4];
        if (params[5] !== undefined) user.ativo = !!params[5];
        user.updated_at = new Date().toISOString();
        rows = [user];
        mutated = true;
      }
    }

    else if (sql.includes('FROM produtos')) {
      if (sql.includes('WHERE id = $1')) {
        const p = dbData.produtos.find(prod => prod.id === params[0]);
        rows = p ? [p] : [];
      } else if (sql.includes('WHERE nome = $1 LIMIT 1') || sql.includes('WHERE nome = $1')) {
        const p = dbData.produtos.find(prod => prod.nome === params[0]);
        rows = p ? [p] : [];
      } else if (sql.includes('SELECT * FROM produtos')) {
        rows = dbData.produtos;
      }
    } else if (sql.startsWith('INSERT INTO produtos')) {
      const newProd = {
        id: generateUuid(),
        nome: params[0],
        marca: params[1],
        categoria: params[2],
        peso_kg: params[3] !== null ? parseFloat(params[3]) : null,
        dimensoes: params[4],
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      dbData.produtos.push(newProd);
      rows = [newProd];
      mutated = true;
    } else if (sql.startsWith('UPDATE produtos')) {
      const id = params[0];
      const pIndex = dbData.produtos.findIndex(prod => prod.id === id);
      if (pIndex !== -1) {
        const prod = dbData.produtos[pIndex];
        if (params[1] !== undefined && params[1] !== '') prod.nome = params[1];
        if (params[2] !== undefined) prod.marca = params[2];
        if (params[3] !== undefined) prod.categoria = params[3];
        if (params[4] !== undefined) prod.peso_kg = params[4] !== null ? parseFloat(params[4]) : null;
        if (params[5] !== undefined) prod.dimensoes = params[5];
        if (params[6] !== undefined) prod.ativo = !!params[6];
        prod.updated_at = new Date().toISOString();
        rows = [prod];
        mutated = true;
      }
    }

    else if (sql.includes('FROM skus')) {
      if (sql.includes('WHERE id = $1')) {
        const s = dbData.skus.find(sku => sku.id === params[0]);
        rows = s ? [s] : [];
      } else if (sql.includes('WHERE s.sku = $1')) {
        const skuVal = params[0];
        const s = dbData.skus.find(sku => sku.sku === skuVal && sku.ativo === true);
        if (s) {
          const p = dbData.produtos.find(prod => prod.id === s.produto_id) || {};
          rows = [{
            ...s,
            produto_nome: p.nome || '',
            produto_marca: p.marca || '',
            categoria: p.categoria || s.categoria || '',
            produto_categoria: p.categoria || ''
          }];
        } else {
          rows = [];
        }
      } else if (sql.includes('SELECT s.*, p.nome AS produto_nome') || sql.includes('FROM skus s')) {
        let filtered = dbData.skus;
        if (params[0] === undefined) {
          filtered = filtered.filter(s => s.ativo === true);
        } else if (params[0] !== null) {
          const activeOnly = !!params[0];
          filtered = filtered.filter(s => s.ativo === activeOnly);
        }

        const hasSearch = params.length > 1 && typeof params[1] === 'string' && params[1].startsWith('%');
        if (hasSearch) {
          const searchVal = params[1].replace(/%/g, '').toLowerCase();
          filtered = filtered.filter(s => {
            const p = dbData.produtos.find(prod => prod.id === s.produto_id) || {};
            return (s.descricao && s.descricao.toLowerCase().includes(searchVal)) ||
                   (s.sku && s.sku.toLowerCase().includes(searchVal)) ||
                   (p.nome && p.nome.toLowerCase().includes(searchVal));
          });
        }

        rows = filtered.map(s => {
          const p = dbData.produtos.find(prod => prod.id === s.produto_id) || {};
          const moves = dbData.movimentacoes_estoque.filter(m => m.sku_id === s.id);
          const balance = moves.reduce((sum, m) => sum + parseInt(m.quantidade || 0, 10), 0);
          return {
            ...s,
            produto_nome: p.nome || '',
            produto_marca: p.marca || '',
            categoria: p.categoria || s.categoria || '',
            produto_categoria: p.categoria || '',
            saldo: balance,
            valor_estoque: balance * parseFloat(s.custo_medio || 0)
          };
        });

        const limitIndex = hasSearch ? 2 : 1;
        if (params[limitIndex] !== undefined && typeof params[limitIndex] === 'number') {
          rows = rows.slice(0, params[limitIndex]);
        }
      }
    } else if (sql.startsWith('INSERT INTO skus')) {
      const newSku = {
        id: generateUuid(),
        produto_id: params[0],
        sku: params[1],
        descricao: params[2],
        volumes_por_camada: params[3] !== null ? parseInt(params[3], 10) : null,
        camadas_maximas_palete: params[4] !== null ? parseInt(params[4], 10) : null,
        quantidade_volumes: params[5] !== null ? parseInt(params[5], 10) : null,
        foto_url: params[6],
        cor: params[7],
        material: params[8],
        codigo_barras_ean: params[9],
        custo_medio: params[10] !== null ? parseFloat(params[10]) : null,
        preco_venda: params[11] !== null ? parseFloat(params[11]) : null,
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      dbData.skus.push(newSku);
      rows = [newSku];
      mutated = true;
    } else if (sql.startsWith('UPDATE skus')) {
      const id = params[0];
      const sIndex = dbData.skus.findIndex(s => s.id === id);
      if (sIndex !== -1) {
        const skuObj = dbData.skus[sIndex];
        if (params[1] !== undefined && params[1] !== '') skuObj.sku = params[1];
        if (params[2] !== undefined && params[2] !== '') skuObj.descricao = params[2];
        if (params[3] !== undefined) skuObj.volumes_por_camada = params[3] !== null ? parseInt(params[3], 10) : null;
        if (params[4] !== undefined) skuObj.camadas_maximas_palete = params[4] !== null ? parseInt(params[4], 10) : null;
        if (params[5] !== undefined) skuObj.quantidade_volumes = params[5] !== null ? parseInt(params[5], 10) : null;
        if (params[6] !== undefined) skuObj.foto_url = params[6];
        if (params[7] !== undefined) skuObj.ativo = !!params[7];
        if (params[8] !== undefined) skuObj.cor = params[8];
        if (params[9] !== undefined) skuObj.material = params[9];
        if (params[10] !== undefined) skuObj.codigo_barras_ean = params[10];
        if (params[11] !== undefined) skuObj.custo_medio = params[11] !== null ? parseFloat(params[11]) : null;
        if (params[12] !== undefined) skuObj.preco_venda = params[12] !== null ? parseFloat(params[12]) : null;
        if (params[13] !== undefined) skuObj.categoria = params[13];
        skuObj.updated_at = new Date().toISOString();
        rows = [skuObj];
        mutated = true;
      }
    }

    else if (sql.includes('FROM armazens')) {
      if (sql.includes('WHERE a.ativo = TRUE') || sql.includes('WHERE ativo = TRUE')) {
        rows = dbData.armazens.filter(a => a.ativo === true);
      } else {
        rows = dbData.armazens;
      }
    }

    else if (sql.includes('FROM conferencias')) {
      if (sql.includes('WHERE id = $1')) {
        const conf = dbData.conferencias.find(c => c.id === params[0]);
        rows = conf ? [conf] : [];
      } else if (sql.includes('WHERE sku_id = $1')) {
        const skuId = params[0];
        let list = dbData.conferencias.filter(c => c.sku_id === skuId);
        list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        rows = list.slice(params[2] || 0, (params[2] || 0) + (params[1] || 50));
      } else if (sql.includes("status_dataset = 'pendente_treinamento'")) {
        let list = dbData.conferencias.filter(c => c.status_dataset === 'pendente_treinamento');
        list.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
        rows = list.slice(0, params[0] || 200);
      } else {
        let list = [...dbData.conferencias];
        list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        const limit = params[0] || 100;
        const offset = params[1] || 0;
        rows = list.slice(offset, offset + limit);
      }
    } else if (sql.startsWith('INSERT INTO conferencias')) {
      const newConf = {
        id: generateUuid(),
        sku_id: params[0],
        armazem_id: params[1],
        id_operador: params[2],
        url_imagem_local: params[3],
        quantidade_contada: params[4] !== null ? parseInt(params[4], 10) : 0,
        quantidade_sugerida_ia: params[5] !== null ? parseInt(params[5], 10) : null,
        quantidade_total: params[6] !== null ? parseInt(params[6], 10) : 0,
        ajuste_manual: params[7] !== null ? parseInt(params[7], 10) : 0,
        origem: params[8] || 'manual',
        status_dataset: params[9] || 'na',
        criada_offline: !!params[10],
        created_at: new Date().toISOString()
      };
      dbData.conferencias.push(newConf);
      rows = [newConf];
      mutated = true;
    } else if (sql.startsWith('UPDATE conferencias')) {
      if (sql.includes("status_dataset = 'treinado'") || sql.includes("status_dataset = $1")) {
        const ids = params[0];
        if (Array.isArray(ids)) {
          ids.forEach(id => {
            const conf = dbData.conferencias.find(c => c.id === id);
            if (conf) conf.status_dataset = 'treinado';
          });
        } else {
          const status = params[0];
          const id = params[1];
          const conf = dbData.conferencias.find(c => c.id === id);
          if (conf) conf.status_dataset = status;
        }
        mutated = true;
      }
    }

    else if (sql.includes('FROM movimentacoes_estoque')) {
      if (sql.includes('WHERE id = $1')) {
        const mov = dbData.movimentacoes_estoque.find(m => m.id === params[0]);
        rows = mov ? [mov] : [];
      } else if (sql.includes('COALESCE(SUM(quantidade), 0)')) {
        if (sql.includes('GROUP BY a.id')) {
          const skuId = params[0];
          const activeWarehouses = dbData.armazens.filter(w => w.ativo === true);
          rows = activeWarehouses.map(w => {
            const balance = dbData.movimentacoes_estoque
              .filter(m => m.armazem_id === w.id && m.sku_id === skuId)
              .reduce((sum, m) => sum + m.quantidade, 0);
            return { armazemId: w.id, nome: w.nome, saldo: balance };
          });
          rows.sort((a,b) => a.nome.localeCompare(b.nome));
        } else if (sql.includes('GROUP BY s.id')) {
          const activeSkus = dbData.skus.filter(s => s.ativo === true);
          rows = activeSkus.map(s => {
            const balance = dbData.movimentacoes_estoque
              .filter(m => m.sku_id === s.id)
              .reduce((sum, m) => sum + m.quantidade, 0);
            return { skuId: s.id, saldoTotal: balance };
          });
        } else {
          const skuId = params[0];
          const armId = params[1];
          let list = dbData.movimentacoes_estoque.filter(m => m.sku_id === skuId);
          if (armId) {
            list = list.filter(m => m.armazem_id === armId);
          }
          const sum = list.reduce((s, m) => s + m.quantidade, 0);
          rows = [{ saldo: sum }];
        }
      } else if (sql.includes('listBySku') || sql.includes('WHERE m.sku_id = $1')) {
        const skuId = params[0];
        const limit = params[1] || 100;
        const offset = params[2] || 0;
        let list = dbData.movimentacoes_estoque.filter(m => m.sku_id === skuId);
        list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        rows = list.slice(offset, offset + limit).map(m => {
          const w = dbData.armazens.find(arm => arm.id === m.armazem_id) || {};
          return {
            ...m,
            criadoEm: m.created_at,
            armazem: { id: w.id || '', nome: w.nome || '' }
          };
        });
      } else {
        let list = [...dbData.movimentacoes_estoque];
        let limit = 100;
        let offset = 0;
        if (params.length >= 2) {
          limit = params[params.length - 2];
          offset = params[params.length - 1];
        }

        let filterSku = null;
        let filterProd = null;
        let filterArm = null;

        let paramIdx = 1;
        if (sql.includes('m.sku_id = $')) {
          filterSku = params[paramIdx - 1];
          paramIdx++;
        }
        if (sql.includes('s.produto_id = $')) {
          filterProd = params[paramIdx - 1];
          paramIdx++;
        }
        if (sql.includes('m.armazem_id = $')) {
          filterArm = params[paramIdx - 1];
          paramIdx++;
        }

        if (filterSku) list = list.filter(m => m.sku_id === filterSku);
        if (filterArm) list = list.filter(m => m.armazem_id === filterArm);
        if (filterProd) {
          list = list.filter(m => {
            const s = dbData.skus.find(sku => sku.id === m.sku_id) || {};
            return s.produto_id === filterProd;
          });
        }

        list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        rows = list.slice(offset, offset + limit).map(m => {
          const s = dbData.skus.find(sku => sku.id === m.sku_id) || {};
          const p = dbData.produtos.find(prod => prod.id === s.produto_id) || {};
          const a = dbData.armazens.find(arm => arm.id === m.armazem_id) || {};
          return {
            ...m,
            sku: s.sku || '',
            produto_descricao: s.descricao || '',
            produto_nome: p.nome || '',
            armazem_nome: a.nome || ''
          };
        });
      }
    } else if (sql.startsWith('INSERT INTO movimentacoes_estoque')) {
      const newMov = {
        id: generateUuid(),
        sku_id: params[0],
        armazem_id: params[1],
        tipo: params[2],
        quantidade: parseInt(params[3], 10),
        id_operador: params[4],
        id_conferencia: params[5],
        observacao: params[6],
        created_at: new Date().toISOString()
      };
      dbData.movimentacoes_estoque.push(newMov);
      rows = [newMov];
      mutated = true;
    }

    if (mutated) {
      writeMockDb(dbData);
    }

    return { rows };
  } catch (err) {
    console.error('[db mock] Erro ao emular query:', err.message, 'SQL:', text);
    throw err;
  }
}

async function query(text, params) {
  if (!useMock && pool) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.message.includes('connect') || err.message.includes('timeout')) {
        console.warn('[db] Conexão com o Postgres recusada/perdida. Mudando para banco mockado.', err.message);
        useMock = true;
      } else {
        throw err;
      }
    }
  }
  return mockQuery(text, params);
}

async function withTransaction(callback) {
  if (useMock) {
    const mockClient = {
      query: async (text, params) => mockQuery(text, params)
    };
    return callback(mockClient);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
