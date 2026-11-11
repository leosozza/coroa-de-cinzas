// Publica o trailer no Instagram (@arcanechess_oficial) como Reel.
// Hospeda o MP4 no Pages, ramo "trailer" (trailer.arcanechess.pages.dev; o ramo "midia" é do robô de hora em hora),
// e publica por video_url. Token no Keychain (instagram-api-key), nunca impresso.
//
// Uso: node tools/trailer/publicar.mjs [--video tools/trailer/saida/trailer.mp4] [--capa-ms 21000] [--so-hospedar]
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const VIDEO = path.resolve(arg('--video', path.join(DIR, 'saida', 'trailer.mp4')));
const CAPA = Number(arg('--capa-ms', 21000));
const IG_USER = '17841451609633495', GRAPH = 'https://graph.facebook.com/v23.0';
const BRANCH = 'trailer', BASE = 'https://trailer.arcanechess.pages.dev';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const token = () => execFileSync('security', ['find-generic-password', '-a', process.env.USER || '', '-s', 'instagram-api-key', '-w'], { encoding:'utf8' }).trim();
async function graph(metodo, rota, campos){
  const body = new URLSearchParams({ ...campos, access_token:token() });
  const res = metodo === 'GET' ? await fetch(`${GRAPH}/${rota}?${body}`) : await fetch(`${GRAPH}/${rota}`, { method:'POST', body });
  const j = await res.json();
  if (j.error) throw new Error(`Graph ${rota}: ${j.error.message}`);
  return j;
}

function hospedar(){
  const id = 'trailer-' + new Date().toISOString().slice(0, 16).replace(/\D/g, '');
  const site = path.join(DIR, 'saida', '_site');
  fs.rmSync(site, { recursive:true, force:true });
  fs.mkdirSync(path.join(site, 'v'), { recursive:true });
  fs.copyFileSync(VIDEO, path.join(site, 'v', `${id}.mp4`));
  fs.writeFileSync(path.join(site, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Arcane Chess</title><a href="https://arcanechess.pages.dev/jogar">Arcane Chess</a>');
  const r = spawnSync('npx', ['-y', 'wrangler@4', 'pages', 'deploy', site, '--project-name', 'arcanechess', '--branch', BRANCH, '--commit-dirty=true'],
    { encoding:'utf8', env:{ ...process.env, CI:'1' } });
  if (r.status !== 0) throw new Error('wrangler: ' + (r.stderr || r.stdout).slice(-400));
  return `${BASE}/v/${id}.mp4`;
}

async function main(){
  if (fs.statSync(VIDEO).size > 25 * 1024 * 1024) throw new Error('o vídeo passa de 25 MB (limite do Pages)');
  const url = hospedar();
  for (let i = 0; i < 12; i++){ const h = await fetch(url, { method:'HEAD' }); if (h.ok) break; await sleep(5000); }
  console.log('hospedado:', url);
  if (process.argv.includes('--so-hospedar')) return;
  const texto = fs.readFileSync(path.join(DIR, 'legenda.txt'), 'utf8').trim();
  const c = await graph('POST', `${IG_USER}/media`, { media_type:'REELS', video_url:url, caption:texto, share_to_feed:'true', thumb_offset:String(CAPA) });
  for (let i = 0; ; i++){
    await sleep(10000);
    const s = await graph('GET', c.id, { fields:'status_code,status' });
    if (s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED' || i > 90) throw new Error('Instagram recusou o vídeo: ' + s.status);
  }
  const p = await graph('POST', `${IG_USER}/media_publish`, { creation_id:c.id });
  const m = await graph('GET', p.id, { fields:'permalink' });
  console.log('publicado:', m.permalink);
}
main().catch(e => { console.error('erro:', e.message); process.exit(1); });
