/**
 * Teste unitário para a lógica de cálculo de Curva ABC e Cobertura
 */
function calcularCurvaABC(itens) {
  const total = itens.reduce((acc, i) => acc + i.valor, 0);
  let acumulado = 0;
  return itens
    .sort((a, b) => b.valor - a.valor)
    .map((item) => {
      acumulado += item.valor;
      const pct = total > 0 ? (acumulado / total) * 100 : 100;
      let curva = 'C';
      if (pct <= 80) curva = 'A';
      else if (pct <= 95) curva = 'B';
      return { ...item, curva, pctAcumulado: pct.toFixed(2) };
    });
}

function calcularCobertura(saldo, mediaDiaria) {
  if (!mediaDiaria || mediaDiaria <= 0) return { dias: null, status: saldo <= 0 ? 'zerado' : 'sem_giro' };
  const dias = Math.round(saldo / mediaDiaria);
  let status = 'ideal';
  if (saldo <= 0 || dias <= 7) status = 'critico';
  else if (dias <= 15) status = 'atencao';
  else if (dias <= 45) status = 'ideal';
  else status = 'excesso';
  return { dias, status };
}

// Teste 1: Curva ABC
const mockItens = [
  { sku: 'MESA-01', valor: 50000 },
  { sku: 'RACK-01', valor: 30000 },
  { sku: 'PAINEL-01', valor: 15000 },
  { sku: 'CADEIRA-01', valor: 4000 },
  { sku: 'PARAFUSO-01', valor: 1000 },
];
const resultadoABC = calcularCurvaABC(mockItens);
console.log('[teste] Curva ABC calculada:');
resultadoABC.forEach(r => console.log(` - ${r.sku}: R$ ${r.valor} -> Curva ${r.curva} (${r.pctAcumulado}%)`));

if (resultadoABC[0].curva !== 'A' || resultadoABC[resultadoABC.length - 1].curva !== 'C') {
  throw new Error('Falha no cálculo da curva ABC');
}

// Teste 2: Cobertura
const cob1 = calcularCobertura(10, 5); // 2 dias -> critico
const cob2 = calcularCobertura(50, 5); // 10 dias -> atencao
const cob3 = calcularCobertura(150, 5); // 30 dias -> ideal
const cob4 = calcularCobertura(300, 5); // 60 dias -> excesso

console.log('[teste] Cobertura calculada:');
console.log(' - Saldo 10, Giro 5/dia:', cob1);
console.log(' - Saldo 50, Giro 5/dia:', cob2);
console.log(' - Saldo 150, Giro 5/dia:', cob3);
console.log(' - Saldo 300, Giro 5/dia:', cob4);

if (cob1.status !== 'critico' || cob2.status !== 'atencao' || cob3.status !== 'ideal' || cob4.status !== 'excesso') {
  throw new Error('Falha no cálculo de cobertura');
}

console.log('🎉 Todos os testes de algoritmos de PCP passaram com 100% de sucesso!');
