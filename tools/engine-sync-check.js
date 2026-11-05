// Falha (código 1) se o motor embutido no HTML divergir de engine/arcano-rules.js.
// node tools/engine-sync-check.js coroa-de-cinzas.html engine/arcano-rules.js
const fs = require('fs');
const [, , HTML = 'coroa-de-cinzas.html', MOD = 'engine/arcano-rules.js'] = process.argv;
const A = '/* ---------- Motor do Modo Arcano', Z = '/* ---------- fim do motor do Arcano ---------- */';
const cut = t => { const a = t.indexOf(A), b = t.indexOf(Z); if (a < 0 || b < 0) throw new Error('marcadores do motor não encontrados'); return t.slice(a, b + Z.length).replace(/\r\n/g, '\n'); };
const h = cut(fs.readFileSync(HTML, 'utf8')), m = cut(fs.readFileSync(MOD, 'utf8'));
if (h !== m){
  const hl = h.split('\n'), ml = m.split('\n');
  let i = 0; while (i < hl.length && hl[i] === ml[i]) i++;
  console.error(`MOTOR DIVERGENTE: primeira diferença na linha ${i + 1} do motor\n  HTML:   ${(hl[i] || '').slice(0, 160)}\n  módulo: ${(ml[i] || '').slice(0, 160)}`);
  process.exit(1);
}
console.log(`motor em sincronia (${h.split("\n").length} linhas)`);
