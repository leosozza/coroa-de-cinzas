// Gera assets/meshy/manifest.json com os modelos que existem, para o jogo não pedir (e levar 404) os que ainda não chegaram.
// Rode de novo sempre que entrar um modelo novo (o deploy pode rodar antes de publicar): node tools/meshy-manifest.js [pasta assets/meshy]
const fs = require('fs'), path = require('path');
const root = process.argv[2] || path.join(__dirname, '..', 'assets', 'meshy');
const files = [];
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes:true })){ const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(glb|gltf\.json)$/.test(e.name)) files.push(path.relative(root, p).split(path.sep).join('/')); } };
walk(root);
files.sort();
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ gerado:new Date().toISOString(), files }, null, 1) + '\n');
console.log(`manifest.json: ${files.length} arquivos`);
