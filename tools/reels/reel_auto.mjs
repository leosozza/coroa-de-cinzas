// Reel automático do Arcane Chess: abre o jogo no Chrome, assiste uma partida IA × IA entre dois reinos sorteados com os
// "Clipes automáticos" ligados, monta um Reel vertical (closes das capturas + o xeque-mate), hospeda o MP4 em
// midia.arcanechess.pages.dev e publica no Instagram pela API (token no Keychain, serviço instagram-api-key).
//
// Uso: node reel_auto.mjs [--url URL_DO_JOGO] [--nao-publicar] [--mostrar]
// O estado (confrontos já feitos) e o registro ficam ao lado do script: estado.json e registro.jsonl.
import { chromium } from 'playwright-core';
import ffmpeg from 'ffmpeg-static';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { legenda, NOMES } from './legendas.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL_JOGO = arg('--url', 'https://arcanechess.pages.dev/jogar');
const PUBLICAR = !process.argv.includes('--nao-publicar');
const MOSTRAR = process.argv.includes('--mostrar');
const MODO = arg('--modo', null); // força 'arcano' ou 'padrao' (testes)
const IG_USER = '17841451609633495';
const GRAPH = 'https://graph.facebook.com/v23.0';
const PAGES_PROJ = 'arcanechess', PAGES_BRANCH = 'midia', MIDIA = 'https://midia.arcanechess.pages.dev';
const OUT = path.join(DIR, 'saida');
const ESTADO = path.join(DIR, 'estado.json');
const LOG = path.join(DIR, 'registro.jsonl');
const TETO_PARTIDA_MS = 12 * 60 * 1000;

const agora = () => new Date().toISOString();
const log = (o) => { const l = JSON.stringify({ t:agora(), ...o }); fs.appendFileSync(LOG, l + '\n'); console.log(l); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function lerEstado(){ try { return JSON.parse(fs.readFileSync(ESTADO, 'utf8')); } catch { return { feitos:[] }; } }
function salvarEstado(e){ fs.writeFileSync(ESTADO, JSON.stringify(e, null, 1)); }

// sorteia o confronto que menos apareceu (os 56 pares ordenados giram antes de repetir), sem repetir nenhum reino do
// post anterior; o Modo Arcano entra em 1 de cada 3 posts
function sortear(e){
  const pares = [];
  for (const w of NOMES) for (const b of NOMES) if (w !== b) pares.push([w, b]);
  const conta = k => e.feitos.filter(f => f === k).length;
  const ult = new Set((e.ultimo || '').split('|').filter(Boolean));
  let pool = pares.filter(p => !ult.has(p[0]) && !ult.has(p[1]));
  if (!pool.length) pool = pares;
  const min = Math.min(...pool.map(p => conta(p.join('|'))));
  const cand = pool.filter(p => conta(p.join('|')) === min);
  return cand[Math.floor(Math.random() * cand.length)];
}
const modoDaVez = e => ((e.n || 0) % 3 === 2 ? 'arcano' : 'padrao');

function token(){
  return execFileSync('security', ['find-generic-password', '-a', process.env.USER || '', '-s', 'instagram-api-key', '-w'], { encoding:'utf8' }).trim();
}

async function graph(metodo, rota, campos){
  const body = new URLSearchParams({ ...campos, access_token:token() });
  const res = metodo === 'GET' ? await fetch(`${GRAPH}/${rota}?${body}`) : await fetch(`${GRAPH}/${rota}`, { method:'POST', body });
  const j = await res.json();
  if (j.error) throw new Error(`Graph ${rota}: ${j.error.message}`);
  return j;
}

async function gravarPartida(w, b, modo, niveis){
  const browser = await chromium.launch({
    channel:'chrome', headless:!MOSTRAR,
    args:['--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=metal'],
  });
  try {
    const page = await (await browser.newContext({ viewport:{ width:860, height:1530 }, deviceScaleFactor:1 })).newPage();
    await page.goto(URL_JOGO, { waitUntil:'load', timeout:120000 });
    await page.waitForTimeout(3000);
    // Modo Espectador → reinos das Brancas e das Negras → arena de um dos dois → regras, níveis e velocidade → Assistir
    await page.evaluate(async ({ w, b, modo, niveis }) => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const pre = 'setup-spec-s';
      const card = [...document.querySelectorAll('*')].find(e => e.textContent.trim() === 'Modo Espectador' && e.children.length === 0);
      card.closest('button,div').click(); await wait(900);
      const vis = () => [...document.querySelectorAll('button')].filter(x => x.offsetParent);
      // cada lado tem o seu painel (passo 1 = Brancas, passo 2 = Negras); abre o painel se estiver fechado e escolhe ali
      const escolher = async (passo, nome) => {
        const head = document.querySelector(`button[aria-controls="${pre}${passo}"]`);
        if (head && head.getAttribute('aria-expanded') !== 'true'){ head.click(); await wait(400); }
        const bt = [...document.getElementById(`${pre}${passo}`).querySelectorAll('button')].find(x => x.textContent.trim().startsWith(nome));
        bt.click(); await wait(400);
        return document.querySelector(`button[aria-controls="${pre}${passo}"]`).textContent;
      };
      // a arena acompanha o reino das Brancas (escolher a arena de um reino troca as Brancas para ele), então não mexe nela
      await escolher(1, w); await escolher(2, b);
      const head = n => document.querySelector(`button[aria-controls="${pre}${n}"]`).textContent;
      if (!head(1).includes(w) || !head(2).includes(b)) throw new Error(`escolha dos reinos falhou: ${head(1)} / ${head(2)}`);
      const sel = (id, v) => { const el = document.getElementById(id); el.value = String(v); el.dispatchEvent(new Event('change', { bubbles:true })); };
      sel('s-rules', modo === 'arcano' ? 'arcano' : 'padrao'); sel('s-w', niveis.w); sel('s-b', niveis.b); sel('s-speed', 'normal'); sel('s-series', 1);
      await wait(300);
      vis().find(x => x.textContent.trim() === 'Assistir').click();
    }, { w, b, modo, niveis });
    const placar = await page.evaluate(() => document.getElementById('spec-score')?.textContent || '');
    console.log('confronto na tela:', placar);
    await page.waitForTimeout(1200);
    await page.evaluate(() => { const r = window.__rec; if (r && !r.manual) document.getElementById('rec-go').click(); });
    const ok = await page.evaluate(() => !!(window.__rec && window.__rec.manual && window.__rec.mime));
    if (!ok) throw new Error('gravador não ligou (MediaRecorder indisponível?)');
    // espera o fim da partida (ou o teto de tempo)
    const t0 = Date.now();
    let fim = null;
    while (Date.now() - t0 < TETO_PARTIDA_MS){
      await page.waitForTimeout(5000);
      fim = await page.evaluate(() => {
        const e = document.getElementById('end');
        if (!e || e.hidden) return null;
        const cor = document.getElementById('end-title').style.color;
        return { titulo:document.getElementById('end-title').textContent, texto:document.getElementById('end-text').textContent,
          lado:/ember/.test(cor) ? 'w' : /blood/.test(cor) ? 'b' : null,
          stats:document.getElementById('end-stats').textContent, segAberto:!!(window.__rec.seg || window.MATE_CINEMA) };
      });
      if (fim && !fim.segAberto) break;
    }
    // segura 2,5 s na posição final e para a gravação
    await page.waitForTimeout(2500);
    await page.evaluate(() => { if (window.__rec.manual) document.getElementById('rec-go').click(); });
    await page.waitForTimeout(2500);
    // tira os clipes da página (base64) e salva
    const clipes = await page.evaluate(async () => {
      const toB64 = blob => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
      const out = [];
      for (const c of window.__rec.clips) out.push({ name:c.name, dur:c.dur, cap:c.cap, mate:!!c.mate, marks:c.marks || [], data:await toB64(c.blob) });
      return out;
    });
    return { fim, clipes };
  } finally { await browser.close(); }
}

// partida inteira: junta os trechos com ação (lances, golpes, feitiços, mate) e corta as pausas da IA pensando
const MAX_S = 178;
function roteiroInteira(c){
  let iv = c.marks.map(([a, z], i) => [Math.max(0, a - (i ? 0.25 : 1.2)), Math.min(c.dur, z + 0.4)]);
  if (!iv.length) return null;
  iv[iv.length - 1][1] = c.dur;
  const m = [];
  for (const x of iv){ const l = m[m.length - 1]; if (l && x[0] - l[1] < 0.5) l[1] = Math.max(l[1], x[1]); else m.push(x.slice()); }
  let total = m.reduce((s, x) => s + x[1] - x[0], 0), fator = 1;
  if (total > MAX_S) fator = Math.min(1.6, total / MAX_S);
  // ainda longo: fica com o final (o mais perto do xeque-mate) que cabe em 3 minutos
  let cut = m;
  if (total / fator > MAX_S){
    cut = []; let s = 0;
    for (let i = m.length - 1; i >= 0 && s < MAX_S * fator; i--){ cut.unshift(m[i]); s += m[i][1] - m[i][0]; }
    total = s;
  }
  return { iv:cut, fator, total:Math.min(total / fator, MAX_S + 1) };
}

function montarInteira(arq, r, saida){
  const sel = r.iv.map(([a, z]) => `between(t,${a.toFixed(3)},${z.toFixed(3)})`).join('+');
  const vf = `fps=30,select='${sel}',setpts=N/30/TB${r.fator > 1.001 ? `,setpts=PTS/${r.fator.toFixed(4)}` : ''},format=yuv420p,setsar=1`;
  const af = `aselect='${sel}',asetpts=N/SR/TB,aresample=48000${r.fator > 1.001 ? `,atempo=${r.fator.toFixed(4)}` : ''}`;
  const args = ['-v', 'error', '-y', '-i', arq, '-filter_complex', `[0:v]${vf}[v];[0:a]${af}[a]`, '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '21', '-maxrate', '8M', '-bufsize', '16M', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-t', String(MAX_S + 1), '-movflags', '+faststart', saida];
  const res = spawnSync(ffmpeg, args, { encoding:'utf8' });
  if (res.status !== 0) throw new Error('ffmpeg: ' + res.stderr.slice(-400));
}

// escolhe os trechos: até 5 closes de captura (espalhados pela partida) + o xeque-mate inteiro
function roteiro(clipes, pasta){
  const cortes = [];
  const caps = clipes.filter(c => !c.mate && c.marks.length);
  const mate = clipes.find(c => c.mate && c.marks.length);
  const n = mate ? 5 : 8;
  const idx = caps.length <= n ? caps.map((_, i) => i) : Array.from({ length:n }, (_, k) => Math.round(k * (caps.length - 1) / (n - 1)));
  for (const i of [...new Set(idx)]){
    const c = caps[i], [a, z] = c.marks[0];
    const ini = Math.max(0, a - 0.15), fimc = Math.min(z, ini + 2.6, c.dur);
    if (fimc - ini >= 0.8) cortes.push({ arq:path.join(pasta, c.name), a:ini, b:fimc });
  }
  if (mate){
    const a = Math.max(0, mate.marks[0][0] - 0.2), z = Math.min(mate.dur, mate.marks[mate.marks.length - 1][1] + 0.6);
    cortes.push({ arq:path.join(pasta, mate.name), a, b:Math.min(z, a + 22) });
  }
  return cortes;
}

function montar(cortes, saida){
  const args = ['-v', 'error', '-y'], fc = [];
  cortes.forEach((c, i) => {
    const d = (c.b - c.a).toFixed(3);
    args.push('-i', c.arq);
    fc.push(`[${i}:v]trim=${c.a.toFixed(3)}:${c.b.toFixed(3)},setpts=PTS-STARTPTS,fps=30,format=yuv420p,setsar=1[v${i}]`);
    fc.push(`[${i}:a]atrim=${c.a.toFixed(3)}:${c.b.toFixed(3)},asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:d=0.05,afade=t=out:st=${Math.max(0, d - 0.07).toFixed(2)}:d=0.07[a${i}]`);
  });
  fc.push(cortes.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${cortes.length}:v=1:a=1[v][a]`);
  args.push('-filter_complex', fc.join(';'), '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '20',
    '-maxrate', '10M', '-bufsize', '20M', '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', saida);
  const r = spawnSync(ffmpeg, args, { encoding:'utf8' });
  if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr.slice(-400));
}

// cabe no teto de 25 MB por arquivo do Pages: bitrate calculado pela duração, 720×1280 quando o bitrate fica baixo
function comprimir(master, saida, dur){
  const alvoBits = 23.5 * 1024 * 1024 * 8 * 0.96, audio = 96000;
  let vb = Math.floor(alvoBits / Math.max(dur, 3) - audio);
  vb = Math.min(vb, 6000000);
  const escala = vb < 2500000 ? 'scale=720:1280:flags=lanczos,' : '';
  const base = ['-v', 'error', '-y', '-i', master, '-vf', `${escala}format=yuv420p`, '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow',
    '-b:v', String(vb), '-maxrate', String(Math.round(vb * 1.4)), '-bufsize', String(vb * 2), '-r', '30'];
  const log = path.join(path.dirname(saida), 'x264pass');
  let r = spawnSync(ffmpeg, [...base, '-pass', '1', '-passlogfile', log, '-an', '-f', 'mp4', '/dev/null'], { encoding:'utf8' });
  if (r.status !== 0) throw new Error('ffmpeg passo 1: ' + r.stderr.slice(-300));
  r = spawnSync(ffmpeg, [...base, '-pass', '2', '-passlogfile', log, '-c:a', 'aac', '-b:a', String(audio), '-ar', '48000', '-movflags', '+faststart', saida], { encoding:'utf8' });
  if (r.status !== 0) throw new Error('ffmpeg passo 2: ' + r.stderr.slice(-300));
  for (const f of fs.readdirSync(path.dirname(saida))) if (f.startsWith('x264pass')) fs.rmSync(path.join(path.dirname(saida), f), { force:true });
  const mb = fs.statSync(saida).size / 1048576;
  if (mb > 24.9) throw new Error(`vídeo ficou com ${mb.toFixed(1)} MB (teto do Pages: 25 MB)`);
  return mb;
}

function hospedar(mp4, id){
  const site = path.join(OUT, '_site');
  fs.rmSync(site, { recursive:true, force:true });
  fs.mkdirSync(path.join(site, 'r'), { recursive:true });
  fs.copyFileSync(mp4, path.join(site, 'r', `${id}.mp4`));
  fs.writeFileSync(path.join(site, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Arcane Chess</title><a href="https://arcanechess.pages.dev/jogar">Arcane Chess</a>');
  const r = spawnSync('npx', ['-y', 'wrangler@4', 'pages', 'deploy', site, '--project-name', PAGES_PROJ, '--branch', PAGES_BRANCH, '--commit-dirty=true'],
    { encoding:'utf8', cwd:OUT, env:{ ...process.env, CI:'1' } });
  if (r.status !== 0) throw new Error('wrangler: ' + (r.stderr || r.stdout).slice(-400));
  return `${MIDIA}/r/${id}.mp4`;
}

// envia o MP4 direto para a Meta (upload "resumable"): sem hospedar o vídeo em lugar nenhum e sem o teto de 25 MB do Pages
async function enviarVideo(mp4, texto, capaMs){
  const c = await graph('POST', `${IG_USER}/media`, { media_type:'REELS', upload_type:'resumable', caption:texto, share_to_feed:'true', thumb_offset:String(capaMs) });
  const buf = fs.readFileSync(mp4);
  const res = await fetch(c.uri || `https://rupload.facebook.com/ig-api-upload/v23.0/${c.id}`, {
    method:'POST', body:buf,
    headers:{ Authorization:`OAuth ${token()}`, offset:'0', file_size:String(buf.length) },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.success === false) throw new Error('upload do vídeo falhou: ' + JSON.stringify(j).slice(0, 300));
  return c.id;
}

async function aguardar(id){
  for (let i = 0; i < 90; i++){
    await sleep(10000);
    const s = await graph('GET', id, { fields:'status_code,status' });
    if (s.status_code === 'FINISHED') return;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error('Instagram recusou o vídeo: ' + s.status);
  }
  throw new Error('Instagram não terminou de processar o vídeo em 15 min');
}

async function publicar(url, texto, capaMs){
  const c = await graph('POST', `${IG_USER}/media`, { media_type:'REELS', video_url:url, caption:texto, share_to_feed:'true', thumb_offset:String(capaMs) });
  await aguardar(c.id);
  const p = await graph('POST', `${IG_USER}/media_publish`, { creation_id:c.id });
  const m = await graph('GET', p.id, { fields:'permalink' });
  return m.permalink;
}

async function main(){
  fs.mkdirSync(OUT, { recursive:true });
  const e = lerEstado();
  const [w, b] = sortear(e), modo = MODO || modoDaVez(e);
  const id = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  // um lado Recruta (1) e o outro Mestre (3): a partida termina rápido e cabe inteira num Reel
  const niveis = Math.random() < 0.5 ? { w:1, b:3 } : { w:3, b:1 };
  log({ etapa:'inicio', id, w, b, modo, niveis, url:URL_JOGO, publicar:PUBLICAR });
  const { fim, clipes } = await gravarPartida(w, b, modo, niveis);
  const pasta = path.join(OUT, id);
  fs.mkdirSync(pasta, { recursive:true });
  for (const c of clipes) fs.writeFileSync(path.join(pasta, c.name), Buffer.from(c.data, 'base64'));
  fs.writeFileSync(path.join(pasta, 'clipes.json'), JSON.stringify(clipes.map(({ data, ...c }) => c), null, 1));
  log({ etapa:'gravado', id, clipes:clipes.length, fim:fim && fim.titulo });
  const inteira = clipes.find(c => /gravacao/.test(c.name)) || clipes[0];
  if (!inteira) throw new Error('nenhuma gravação saiu da página');
  const rot = roteiroInteira(inteira);
  if (!rot) throw new Error('gravação sem trechos de ação');
  const mp4 = path.join(pasta, `reel-${id}.mp4`);
  montarInteira(path.join(pasta, inteira.name), rot, mp4);
  const total = rot.total;
  // vencedor: o texto do fim diz "<artigo> <reino> vence"
  let venc = fim && /Xeque-mate/i.test(fim.titulo) ? fim.lado : null;
  if (!venc && fim && /Xeque-mate/i.test(fim.titulo)){
    const t = fim.texto;
    const iw = t.indexOf(w.split(' ').slice(-2).join(' ')), ib = t.indexOf(b.split(' ').slice(-2).join(' '));
    venc = iw >= 0 && (ib < 0 || iw < ib) ? 'w' : ib >= 0 ? 'b' : null;
  }
  const lances = fim ? +(fim.stats.match(/(\d+)\s*lances/) || [0, 0])[1] : 0;
  const texto = legenda({ w, b, venc, lances: lances || 60, arcano:modo === 'arcano', niveis, minutos:total / 60 });
  fs.writeFileSync(path.join(pasta, 'legenda.txt'), texto);
  log({ etapa:'montado', id, segundos:+total.toFixed(1), fator:+rot.fator.toFixed(2), trechos:rot.iv.length, venc, lances });
  if (!PUBLICAR){ log({ etapa:'fim-sem-publicar', id, mp4 }); return; }
  const capaMs = Math.round(Math.max(0, total - 9) * 1000);
  const leve = path.join(pasta, `reel-${id}-ig.mp4`);
  const mb = comprimir(mp4, leve, total);
  log({ etapa:'comprimido', id, mb:+mb.toFixed(1) });
  const url = hospedar(leve, id);
  const link = await publicar(url, texto, capaMs);
  e.feitos.push(`${w}|${b}`); e.ultimo = `${w}|${b}`; e.n = (e.n || 0) + 1; salvarEstado(e);
  log({ etapa:'publicado', id, link });
  // guarda só os 48 últimos Reels no disco
  const pastas = fs.readdirSync(OUT).filter(n => /^\d{12}$/.test(n)).sort();
  for (const p of pastas.slice(0, -48)) fs.rmSync(path.join(OUT, p), { recursive:true, force:true });
}

main().catch(err => { log({ etapa:'erro', erro:String(err && err.message || err) }); process.exit(1); });
