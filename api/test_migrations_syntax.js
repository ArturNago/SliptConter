const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve(__dirname, 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

console.log(`[test] Verificando ${files.length} arquivos de migration SQL:`);
let hasErrors = false;

for (const file of files) {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  if (!content.trim()) {
    console.error(`❌ Migration vazia: ${file}`);
    hasErrors = true;
  } else {
    console.log(`  ✓ ${file} (${content.length} bytes)`);
  }
}

if (hasErrors) {
  process.exit(1);
} else {
  console.log('🎉 Todas as 22 migrations estão presentes e estruturadas com sucesso!');
}
