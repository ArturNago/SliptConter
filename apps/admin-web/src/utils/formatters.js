/**
 * Formatadores utilitários para o Painel Web.
 */

const fmtMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const fmtNumero = new Intl.NumberFormat('pt-BR');

const fmtData = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatarMoeda(valor) {
  const n = Number(valor || 0);
  return fmtMoeda.format(n);
}

export function formatarNumero(valor) {
  return fmtNumero.format(Number(valor || 0));
}

export function formatarData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return fmtData.format(d);
}

export function formatarDataCurta(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

/**
 * Gera um CSV a partir de um array de objetos.
 * @param {Array<object>} linhas
 * @param {Array<{chave:string, rotulo:string}>} colunas
 */
export function gerarCSV(linhas, colunas) {
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cabecalho = colunas.map((c) => escape(c.rotulo)).join(';');
  const corpo = linhas
    .map((linha) => colunas.map((c) => escape(linha[c.chave])).join(';'))
    .join('\n');
  return `${cabecalho}\n${corpo}`;
}

export function baixarArquivo(conteudo, nomeArquivo, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + conteudo], { type: mime }); // BOM p/ acentos no Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
