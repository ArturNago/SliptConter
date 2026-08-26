const fs = require('fs');

const allSkus = JSON.parse(fs.readFileSync('all_skus.json', 'utf8'));
const estoqueData = JSON.parse(fs.readFileSync('../estoque.json', 'utf8'));

// Helper to normalize strings for comparison
function normalize(str) {
  if (!str) return '';
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, ' ');
}

const unmapped = [];
const mapped = [];

for (let row of estoqueData) {
  let name = normalize(row['Armazém.2'] || row['Armazém.1']);
  let originalName = row['Armazém.1'];
  let qty = row['Armazém.4'];
  
  if (typeof qty !== 'number') continue;
  
  // Try exact match first
  let match = allSkus.find(s => normalize(s.descricao) === name);
  
  if (!match) {
    // Try word matching
    let words = name.split(' ').filter(w => w.length > 2);
    let candidates = allSkus.filter(s => {
      let desc = normalize(s.descricao);
      return words.every(w => desc.includes(w));
    });
    
    if (candidates.length === 1) {
      match = candidates[0];
    } else if (candidates.length > 1) {
      // Find the best fit based on length or specific words
      // e.g. kit vs non-kit
      let nonKits = candidates.filter(c => !normalize(c.descricao).includes('kit'));
      if (!name.includes('kit') && nonKits.length === 1) {
         match = nonKits[0];
      } else {
         unmapped.push({ originalName, name, qty, candidates: candidates.map(c => c.descricao) });
         continue;
      }
    }
  }
  
  if (match) {
    mapped.push({ originalName, matchedDesc: match.descricao, sku_id: match.id, qty });
  } else {
    unmapped.push({ originalName, name, qty, candidates: [] });
  }
}

fs.writeFileSync('mapping_results.json', JSON.stringify({ mapped, unmapped }, null, 2));
console.log(`Mapped: ${mapped.length}, Unmapped: ${unmapped.length}`);
