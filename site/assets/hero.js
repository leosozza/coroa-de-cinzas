/* Arcane Chess — hero ao vivo: a Partida da Ópera (Morphy, Paris 1858) em loop, como uma transmissão de TV.
   Three.js r128 + GLTFLoader (+ DRACO quando houver .c.gltf.json) + chess.js 0.10.3, carregados sob demanda.
   Pôster até os modelos principais chegarem; sem WebGL, com erro ou com prefers-reduced-motion, fica no pôster.
   Padrões reaproveitados do jogo (coroa-de-cinzas.html ~6600–6990): manifesto, medida pelos ossos, giro pela cabeça,
   altura-alvo por tipo, torre composta (base + arqueiro), tinta da Legião, clipes extras no mesmo esqueleto. */
(function(){
  'use strict';
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;
  const AC = window.AC || {};
  const ASSETS = AC.ASSETS || '../assets/', DATA = AC.DATA || '../data/';
  const $h = s => hero.querySelector(s);
  const canvas = $h('.hero__canvas');
  const ui = {
    caption:$h('[data-bc-caption]'), tag:$h('[data-bc-tag]'), sub:$h('[data-bc-sub]'), cam:$h('[data-bc-cam]'),
    capsW:$h('[data-caps-w]'), capsB:$h('[data-caps-b]'), ply:$h('[data-bc-ply]'), score:$h('.bc-score'), progress:$h('.bc-progress'),
    sound:$h('[data-bc-sound]'), pause:$h('[data-bc-pause]'), stamp:$h('[data-bc-stamp]'), flash:$h('.hero__flash'), fade:$h('.hero__fade'),
    start:$h('[data-bc-start]'),
  };
  const QS = new URLSearchParams(location.search);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- níveis de qualidade ---------- */
  const TIERS = {
    high:{ dpr:1.75, shadow:2048, soft:true, embers:560, extras:true, dragon:true, aa:true },
    mid:{ dpr:1.25, shadow:1024, soft:false, embers:300, extras:true, dragon:false, aa:true },
    low:{ dpr:1.5, shadow:0, soft:false, embers:140, extras:false, dragon:false, aa:false },
  };
  function pickTier(){
    const q = QS.get('q'); if (TIERS[q]) return q;
    const coarse = matchMedia('(pointer: coarse)').matches, small = Math.min(screen.width, screen.height) < 700;
    if (coarse || small) return 'low';
    if ((navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 2) return 'mid';
    return 'high';
  }
  let tierName = pickTier(), TIER = Object.assign({}, TIERS[tierName]);
  const stats = window.__heroStats = { tier:tierName, dpr:0, fps:0, state:'poster', loaded:[], errors:[], cycle:0, ply:0 };

  /* ---------- legenda e placar ---------- */
  function setCaption(txt, tag, sub){
    if (tag != null && ui.tag) ui.tag.textContent = tag;
    if (sub != null && ui.sub) ui.sub.textContent = sub;
    if (!ui.caption) return;
    const sp = ui.caption.firstElementChild || ui.caption.appendChild(document.createElement('span'));
    sp.classList.add('is-swap');
    setTimeout(() => { sp.innerHTML = txt; sp.classList.remove('is-swap'); }, 160);
  }
  const setCam = t => { if (ui.cam) ui.cam.textContent = t; };
  function flash(){ if (!ui.flash) return; ui.flash.classList.remove('go'); void ui.flash.offsetWidth; ui.flash.classList.add('go'); }

  /* ---------- carregamento preguiçoso de scripts ---------- */
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error('script ' + src)); document.head.appendChild(s); });
  const CDN = {
    three:'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    gltf:'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
    draco:'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/DRACOLoader.js',
    dracoPath:'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/gltf/',
    skel:'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js',
    chess:'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js',
  };

  /* ---------- a partida ---------- */
  const OPERA = ['e4','e5','Nf3','d6','d4','Bg4','dxe5','Bxf3','Qxf3','dxe5','Bc4','Nf6','Qb3','Qe7','Nc3','c6','Bg5','b5','Nxb5','cxb5','Bxb5+','Nbd7','O-O-O','Rd8','Rxd7','Rxd7','Rd1','Qe6','Bxd7+','Nxd7','Qb8+','Nxb8','Rd8#'];
  const NAME = { p:'o peão', n:'o cavaleiro', b:'o bispo', r:'a torre', q:'a dama', k:'o rei', L:'o lanceiro', D:'o Dragão das Cinzas' };
  const GLYPH = { p:'♟', n:'♞', b:'♝', r:'♜', q:'♛', k:'♚' };
  const SANP = { N:'♘', B:'♗', R:'♖', Q:'♕', K:'♔' };
  const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
  // golpe por par atacante × vítima (data/plano-golpes.md, seção 2)
  const MATRIX = {
    p:{ p:'lamina', n:'arremesso', b:'magia:arcano', r:'explosao', q:'veneno' },
    L:{ p:'lamina', n:'lamina', b:'lamina', r:'lamina', q:'lamina' },
    n:{ p:'investida', n:'investida', b:'arremesso', r:'explosao', q:'lamina' },
    b:{ p:'magia:raio', n:'magia:gelo', b:'magia:arcano', r:'magia:fogo', q:'magia:arcano' },
    r:{ p:'flecha', n:'flecha', b:'magia:fogo', r:'explosao', q:'veneno' },
    q:{ p:'lamina', n:'magia:raio', b:'magia:arcano', r:'explosao', q:'veneno' },
    k:{ p:'lamina', n:'lamina', b:'lamina', r:'explosao', q:'lamina' },
    D:{ p:'sopro', n:'sopro', b:'sopro', r:'sopro', q:'sopro' },
  };
  const GOLPE_NOME = { lamina:'golpe de lâmina', arremesso:'arremesso', explosao:'explosão', veneno:'veneno', investida:'investida', flecha:'flechas', sopro:'sopro de fogo',
    'magia:raio':'raio', 'magia:gelo':'gelo', 'magia:arcano':'magia arcana', 'magia:fogo':'fogo' };
  const DEATH = { lamina:'dying_backwards', arremesso:'Shot_and_Fall_Forward', explosao:'Shot_and_Blown_Back', veneno:'Strangled_and_Fall_Forward', investida:'Shot_and_Blown_Back',
    flecha:'Shot_and_Slow_Fall_Backward', sopro:'Electrocuted_Fall', magia:'Electrocuted_Fall' };
  const ELEM = { raio:[0xfff1a0, 0xffd34a], gelo:[0xd8f4ff, 0x6fc6ff], arcano:[0xe7d6ff, 0xa985ff], fogo:[0xffd08a, 0xff6a1e] };

  /* ---------- modelos (assets/meshy/<slug>/...) ---------- */
  const SPEC = {
    p:{ slug:'peao', file:'animated', rigged:true, h:0.98, w:0.62, attack:/thrust|slash/i },
    b:{ slug:'bispo', file:'animated', rigged:true, h:1.28, w:0.72, attack:/spell|cast/i, cheer:true },
    q:{ slug:'dama', file:'animated', rigged:true, h:1.42, w:0.75, attack:/cast|soell|spell/i, cheer:true },
    k:{ slug:'rei', file:'animated', rigged:true, h:1.46, w:0.8, attack:/sword|slash/i, walk:true, cheer:true },
    n:{ slug:'cavalo_montado', file:'model', rigged:false, h:1.45, w:1.0 },
    rb:{ slug:'torre_base', file:'model', rigged:false, h:1.25, w:0.85, stretch:1.36 },
    ra:{ slug:'arqueiro', file:'animated', rigged:true, h:0.98, w:0.62, attack:/arch|shot|bow/i },
    L:{ slug:'peao_lanca', file:'animated', rigged:true, h:1.04, w:0.7, attack:/thrust|slash/i },
    D:{ slug:'dragao', file:'animated', rigged:true, h:1.8, w:2.1, dragon:true },
  };
  // golpes.gltf.json: só os clipes de cada peça (o modelo do arquivo é descartado)
  const EXTRA = { p:'peao', b:'bispo', q:'dama', k:'rei', ra:'arqueiro' };
  let MANIFEST = null, THREE = null, loader = null, dracoOK = false;
  const TPL = {};
  const has = rel => !MANIFEST || MANIFEST.has(rel);

  async function loadLibs(){
    await loadScript(CDN.three);
    THREE = window.THREE;
    await Promise.all([loadScript(CDN.gltf), loadScript(CDN.skel), loadScript(CDN.chess), loadScript(CDN.draco).then(() => { dracoOK = !!THREE.DRACOLoader; }).catch(() => { dracoOK = false; })]);
    loader = new THREE.GLTFLoader();
    if (dracoOK){ const d = new THREE.DRACOLoader(); d.setDecoderPath(CDN.dracoPath); loader.setDRACOLoader(d); }
  }
  async function loadManifest(){
    try { const r = await fetch(ASSETS + 'meshy/manifest.json', { cache:'no-cache' }); if (r.ok){ const j = await r.json(); if (Array.isArray(j.files)) MANIFEST = new Set(j.files); } } catch (e){}
  }
  const prog = {};
  function progress(){
    const v = Object.values(prog); if (!v.length) return;
    const k = v.reduce((a, b) => a + b, 0) / v.length;
    if (ui.progress) ui.progress.style.width = (k * 100).toFixed(1) + '%';
    if (stats.state === 'loading') setCaption(`Preparando a transmissão… ${Math.round(k * 100)}%`);
  }
  function loadGltf(list, key){
    list = list.filter(has);
    if (!list.length) return Promise.resolve(null);
    if (key) prog[key] = 0;
    return new Promise(res => {
      const next = i => {
        if (i >= list.length){ if (key) prog[key] = 1; return res(null); }
        loader.load(ASSETS + 'meshy/' + list[i], g => { if (key){ prog[key] = 1; progress(); } stats.loaded.push(list[i]); res(g); },
          x => { if (key && x && x.total){ prog[key] = Math.min(.98, x.loaded / x.total); progress(); } },
          e => { stats.errors.push(list[i] + ': ' + (e && e.message || e)); next(i + 1); });
      };
      next(0);
    });
  }
  const urlsFor = sp => (dracoOK ? [`${sp.slug}/${sp.file}.c.gltf.json`] : []).concat([`${sp.slug}/${sp.file}.opt.gltf.json`, `${sp.slug}/${sp.file}.glb`]);
  // só os clipes: baixa o JSON, tira malhas, texturas e peles e entrega ao GLTFLoader (sem subir nada para a GPU)
  async function loadClips(rel){
    if (!has(rel)) return [];
    try {
      const r = await fetch(ASSETS + 'meshy/' + rel); if (!r.ok) return [];
      const j = await r.json();
      for (const k of ['meshes', 'materials', 'textures', 'images', 'samplers', 'skins']) delete j[k];
      for (const n of j.nodes || []){ delete n.mesh; delete n.skin; }
      if (j.extensionsUsed) j.extensionsUsed = j.extensionsUsed.filter(x => x !== 'KHR_draco_mesh_compression' && x !== 'EXT_texture_webp');
      delete j.extensionsRequired;
      const g = await new Promise((res, rej) => loader.parse(JSON.stringify(j), ASSETS + 'meshy/', res, rej));
      stats.loaded.push(rel);
      return g.animations || [];
    } catch (e){ stats.errors.push(rel + ': ' + (e && e.message || e)); return []; }
  }

  /* ---------- medidas (como o jogo: vértices deformados pelos ossos) ---------- */
  const findBone = (root, re) => { let f = null; root.traverse(o => { if (!f && o.isBone && re.test(o.name)) f = o; }); return f; };
  function measure(scene){
    const box = new THREE.Box3(), v = new THREE.Vector3();
    scene.updateMatrixWorld(true);
    scene.traverse(o => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      if (o.isSkinnedMesh && o.boneTransform){
        o.skeleton.update();
        const step = Math.max(1, Math.floor(pos.count / 1500));
        for (let i = 0; i < pos.count; i += step){ o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld); box.expandByPoint(v); }
      } else for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / 3000))){ v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); box.expandByPoint(v); }
    });
    return box;
  }
  function impactOf(T, clip, frac){
    if (!clip) return 0;
    T.impacts = T.impacts || new Map();
    if (T.impacts.has(clip)) return T.impacts.get(clip);
    const scene = T.scene, hand = findBone(scene, /right.?hand|hand.?r\b/i) || findBone(scene, /right.?fore/i), hips = findBone(scene, /hips|pelvis/i);
    let bt = clip.duration * (frac || 0.45);
    if (hand && !frac){
      const saved = []; scene.traverse(o => { if (o.isBone) saved.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); });
      const mixer = new THREE.AnimationMixer(scene), act = mixer.clipAction(clip); act.play();
      const v = new THREE.Vector3(), h = new THREE.Vector3(); let best = -Infinity;
      for (let i = 4; i <= 44; i++){
        const t = clip.duration * i / 49; mixer.setTime(t); scene.updateMatrixWorld(true);
        hand.getWorldPosition(v); if (hips) hips.getWorldPosition(h); else h.set(0, 0, 0);
        // eixo de frente do modelo já corrigido pelo giro (+Z no espaço do pai)
        const f = (v.z - h.z) * Math.cos(T.yaw) + (v.x - h.x) * Math.sin(T.yaw);
        if (f > best){ best = f; bt = t; }
      }
      act.stop(); mixer.uncacheRoot(scene);
      for (const [o, p, q, s] of saved){ o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); }
      scene.updateMatrixWorld(true);
    }
    T.impacts.set(clip, bt);
    return bt;
  }
  function prepTemplate(key, gltf){
    const sp = SPEC[key], scene = gltf.scene;
    let yaw = 0;
    const head = findBone(scene, /^head$/i) || findBone(scene, /head/i), front = findBone(scene, /headfront|head_front|nose/i);
    scene.updateMatrixWorld(true);
    if (head && front){ const a = head.getWorldPosition(new THREE.Vector3()), b = front.getWorldPosition(new THREE.Vector3()); if (Math.hypot(b.x - a.x, b.z - a.z) > 1e-4) yaw = -Math.atan2(b.x - a.x, b.z - a.z); }
    scene.rotation.y = yaw;
    const box = measure(scene), size = box.getSize(new THREE.Vector3());
    let s = sp.h / Math.max(1e-4, size.y);
    if (Math.max(size.x, size.z) * s > sp.w) s = sp.w / Math.max(size.x, size.z);
    const sy = sp.stretch ? Math.min(sp.h / Math.max(1e-4, size.y), s * sp.stretch) : s;
    const mats = new Set();
    scene.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = !!TIER.shadow; o.receiveShadow = false;
      if (o.isSkinnedMesh) o.frustumCulled = false;
      for (const m of [].concat(o.material)) mats.add(m);
    });
    for (const m of mats){ if ('envMapIntensity' in m) m.envMapIntensity = 0.9; if (m.map && renderer) m.map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); }
    const clips = {};
    for (const a of gltf.animations || []){
      const n = a.name.toLowerCase();
      if (!clips.idle && /idle|stand|breath/.test(n)) clips.idle = a;
      else if (!clips.death && /dy|death|die/.test(n)) clips.death = a;
      else if (!clips.walk && /walk|run/.test(n)) clips.walk = a;
      else if (!clips.attack && (!sp.attack || sp.attack.test(n))) clips.attack = a;
      clips[a.name] = a;
    }
    if (sp.dragon && !clips.idle) clips.idle = gltf.animations && gltf.animations[0];
    const T = { key, scene, clips, s, sy, yaw, rigged:!!sp.rigged && !!clips.idle,
      off:new THREE.Vector3(-(box.min.x + box.max.x) / 2 * s, -box.min.y * sy, -(box.min.z + box.max.z) / 2 * s), height:size.y * sy, tint:new Map() };
    TPL[key] = T;
    return T;
  }
  // clipes extras: rotações sempre; posição só do quadril (queda e ajoelhar), nunca escala
  function addClips(key, anims, kind){
    const T = TPL[key]; if (!T) return;
    for (const a of anims){
      a.tracks = a.tracks.filter(t => /\.quaternion$/.test(t.name) || (kind === 'golpes' && /(hips|pelvis)[^.]*\.position$/i.test(t.name)));
      const nm = kind === 'cheer' ? 'cheer' : kind === 'walk' ? 'walk' : a.name;
      T.clips[nm] = a;
    }
  }

  /* ---------- cena ---------- */
  let renderer = null, scene = null, camera = null, envTex = null, glowTex = null, smokeTex = null, runeTex = null;
  let moon = null, fxLight = null, braziers = [], embers = null, flames = [], runeRing = null, lastMarks = [];
  const S = 1; // casa
  const sqPos = (sq, y = 0) => new THREE.Vector3(('abcdefgh'.indexOf(sq[0]) - 3.5) * S, y, (4.5 - +sq[1]) * S);
  const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  const C = h => new THREE.Color(h).convertSRGBToLinear();
  const Craw = h => new THREE.Color(h);

  function canvasTex(c){ const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }
  function mkCanvas(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function makeTextures(){
    let c = mkCanvas(128, 128), g = c.getContext('2d');
    let gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(.6, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); glowTex = new THREE.CanvasTexture(c);
    c = mkCanvas(128, 128); g = c.getContext('2d');
    for (let i = 0; i < 26; i++){
      const x = 64 + (Math.random() - .5) * 50, y = 64 + (Math.random() - .5) * 50, r = 18 + Math.random() * 26;
      gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    smokeTex = new THREE.CanvasTexture(c);
    // círculo de runas: anéis e marcas riscadas
    c = mkCanvas(512, 512); g = c.getContext('2d'); g.translate(256, 256); g.strokeStyle = '#fff'; g.lineCap = 'round';
    const ring = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
    ring(244, 3); ring(228, 1.5); ring(170, 2.5); ring(120, 1.2);
    for (let i = 0; i < 28; i++){
      g.save(); g.rotate(i / 28 * Math.PI * 2); g.translate(0, -199); g.lineWidth = 2.4; g.beginPath();
      const k = (i * 7) % 5;
      g.moveTo(0, -14); g.lineTo(0, 14);
      if (k === 0){ g.moveTo(0, -6); g.lineTo(8, -14); g.moveTo(0, 2); g.lineTo(8, -6); }
      if (k === 1){ g.moveTo(0, -14); g.lineTo(9, -4); g.lineTo(0, 6); }
      if (k === 2){ g.moveTo(-8, -10); g.lineTo(8, 10); }
      if (k === 3){ g.moveTo(0, -14); g.lineTo(-8, -4); g.moveTo(0, -4); g.lineTo(8, 6); }
      if (k === 4){ g.moveTo(-7, 0); g.lineTo(7, 0); g.moveTo(-7, -8); g.lineTo(0, -14); g.lineTo(7, -8); }
      g.stroke(); g.restore();
    }
    g.lineWidth = 2; g.beginPath();
    for (let i = 0; i <= 6; i++){ const a = i / 6 * Math.PI * 2 * 2 - Math.PI / 2; const x = Math.cos(a) * 165, y = Math.sin(a) * 165; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    runeTex = new THREE.CanvasTexture(c);
  }
  function makeEnv(){
    const c = mkCanvas(256, 128), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
    for (const [cl, k] of [['#4a4458', 0], ['#2a2420', .42], ['#5a3420', .55], ['#120d0a', 1]]) gr.addColorStop(k, cl);
    g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    for (const [x, y, r, cl] of [[30, 64, 14, '#ffb060'], [100, 62, 10, '#ff8a40'], [170, 64, 14, '#ffb060'], [230, 62, 10, '#ff8a40'], [80, 18, 34, '#8a7fa8']]){
      const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, cl); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = canvasTex(c); t.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromEquirectangular(t); pm.dispose(); t.dispose();
    envTex = rt.texture;
  }
  function boardTexture(){
    const N = 1024, c = mkCanvas(N, N), g = c.getContext('2d'), F = N * 0.5 / 9, Q = (N - 2 * F) / 8;
    // moldura: pedra escura com filete dourado
    g.fillStyle = '#1b1712'; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 2600; i++){ g.fillStyle = `rgba(${Math.random() < .5 ? '255,220,170' : '0,0,0'},${Math.random() * .05})`; g.fillRect(Math.random() * N, Math.random() * N, 2 + Math.random() * 6, 1 + Math.random() * 3); }
    g.strokeStyle = '#b78a3c'; g.lineWidth = 3; g.strokeRect(F - 10, F - 10, N - 2 * F + 20, N - 2 * F + 20);
    g.strokeStyle = 'rgba(183,138,60,.45)'; g.lineWidth = 1.5; g.strokeRect(14, 14, N - 28, N - 28);
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++){
      const light = (r + f) % 2 === 0, x = F + f * Q, y = F + r * Q;
      g.fillStyle = light ? '#b9ab8e' : '#2c2620'; g.fillRect(x, y, Q, Q);
      // veios de mármore e granulado
      for (let k = 0; k < 7; k++){
        g.strokeStyle = light ? `rgba(90,74,52,${.06 + Math.random() * .08})` : `rgba(160,140,110,${.03 + Math.random() * .05})`; g.lineWidth = .6 + Math.random() * 1.4;
        g.beginPath(); let px = x + Math.random() * Q, py = y; g.moveTo(px, py);
        for (let s = 0; s < 5; s++){ px += (Math.random() - .5) * Q * .5; py += Q / 5; g.lineTo(Math.max(x, Math.min(x + Q, px)), py); }
        g.stroke();
      }
      g.fillStyle = light ? 'rgba(255,250,235,.06)' : 'rgba(0,0,0,.12)'; g.fillRect(x + 2, y + 2, Q - 4, Q - 4);
    }
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
    for (let i = 0; i <= 8; i++){ g.beginPath(); g.moveTo(F + i * Q, F); g.lineTo(F + i * Q, N - F); g.stroke(); g.beginPath(); g.moveTo(F, F + i * Q); g.lineTo(N - F, F + i * Q); g.stroke(); }
    g.fillStyle = '#c9a25a'; g.font = `700 ${Math.round(F * .42)}px Cinzel, Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 8; i++){
      const L = 'abcdefgh'[i];
      g.fillText(L.toUpperCase(), F + (i + .5) * Q, N - F / 2); g.save(); g.translate(F + (i + .5) * Q, F / 2); g.rotate(Math.PI); g.fillText(L.toUpperCase(), 0, 0); g.restore();
      g.fillText(String(8 - i), F / 2, F + (i + .5) * Q); g.save(); g.translate(N - F / 2, F + (i + .5) * Q); g.rotate(Math.PI); g.fillText(String(8 - i), 0, 0); g.restore();
    }
    return canvasTex(c);
  }
  function stoneTexture(){
    const N = 512, c = mkCanvas(N, N), g = c.getContext('2d');
    g.fillStyle = '#1d1915'; g.fillRect(0, 0, N, N);
    // lajes irregulares
    const rows = 6;
    for (let r = 0; r < rows; r++){
      let x = -Math.random() * 60; const h = N / rows;
      while (x < N){ const w = 60 + Math.random() * 90, l = 20 + Math.random() * 14; g.fillStyle = `rgb(${l + 8},${l + 3},${l - 2})`; g.fillRect(x + 2, r * h + 2, w - 4, h - 4); x += w; }
    }
    for (let i = 0; i < 4000; i++){ g.fillStyle = `rgba(${Math.random() < .5 ? '255,230,200' : '0,0,0'},${Math.random() * .06})`; g.fillRect(Math.random() * N, Math.random() * N, 1 + Math.random() * 3, 1 + Math.random() * 3); }
    const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 9);
    return t;
  }

  function buildScene(){
    scene = new THREE.Scene();
    scene.background = C(0x0b0908);
    scene.fog = new THREE.Fog(C(0x0d0a08), 16, 44);
    camera = new THREE.PerspectiveCamera(38, 1, 0.3, 140);
    makeTextures(); makeEnv();
    scene.environment = null;
    // céu: gradiente com brasa no horizonte
    const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), new THREE.ShaderMaterial({
      side:THREE.BackSide, depthWrite:false, fog:false,
      uniforms:{ top:{ value:Craw(0x0a0812) }, mid:{ value:Craw(0x3a1a12) }, low:{ value:Craw(0x090706) }, t:{ value:0 } },
      vertexShader:'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:'uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform float t; varying vec3 vP; void main(){ float y = vP.y; vec3 c = mix(mid, top, smoothstep(0.02, 0.55, y)); c = mix(low, c, smoothstep(-0.12, 0.04, y)); float a = atan(vP.z, vP.x); c += vec3(0.16, 0.05, 0.02) * (0.5 + 0.5 * sin(a * 3.0 + t * 0.05)) * exp(-abs(y - 0.05) * 9.0); gl_FragColor = vec4(c, 1.0); }',
    }));
    sky.renderOrder = -10; scene.add(sky); scene.userData.sky = sky;
    // chão de lajes
    const ground = new THREE.Mesh(new THREE.CircleGeometry(48, 48), new THREE.MeshStandardMaterial({ map:stoneTexture(), color:C(0x8a7d6c), roughness:.95, metalness:0 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.36; ground.receiveShadow = !!TIER.shadow; scene.add(ground);
    // círculo de runas em volta do tabuleiro
    runeRing = new THREE.Mesh(new THREE.PlaneGeometry(17, 17), new THREE.MeshBasicMaterial({ map:runeTex, color:C(0xe3a548), transparent:true, opacity:.32, blending:THREE.AdditiveBlending, depthWrite:false }));
    runeRing.rotation.x = -Math.PI / 2; runeRing.position.y = -0.34; scene.add(runeRing);
    // tabuleiro sobre o estrado
    const base = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.36, 9.4), new THREE.MeshStandardMaterial({ color:C(0x1a1611), roughness:.75, metalness:.2, envMap:envTex }));
    base.position.y = -0.18; base.receiveShadow = !!TIER.shadow; base.castShadow = !!TIER.shadow; scene.add(base);
    const trimM = new THREE.MeshStandardMaterial({ color:C(0xb78a3c), roughness:.35, metalness:.9, envMap:envTex, envMapIntensity:1.2 });
    for (const [x, z, w, d] of [[0, 4.71, 9.44, .04], [0, -4.71, 9.44, .04], [4.71, 0, .04, 9.44], [-4.71, 0, .04, 9.44]]){ const t = new THREE.Mesh(new THREE.BoxGeometry(w, .05, d), trimM); t.position.set(x, -0.02, z); scene.add(t); }
    const top = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshStandardMaterial({ map:boardTexture(), roughness:.55, metalness:.05, envMap:envTex, envMapIntensity:.5 }));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.001; top.receiveShadow = !!TIER.shadow; scene.add(top);
    // pilares partidos e braseiros
    const stoneM = new THREE.MeshStandardMaterial({ color:C(0x3a332b), roughness:.9, flatShading:true });
    const glowM = new THREE.SpriteMaterial({ map:glowTex, color:C(0xff9a3c), transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, fog:false });
    for (let i = 0; i < 10; i++){
      const a = i / 10 * Math.PI * 2 + .2, R = 11.5 + (i % 3) * 1.6, h = 2.2 + ((i * 37) % 7) * .55;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(.42, .52, h, 7), stoneM);
      col.position.set(Math.cos(a) * R, -0.36 + h / 2, Math.sin(a) * R); col.rotation.z = ((i * 13) % 5 - 2) * .02; col.castShadow = false; scene.add(col);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(.62, .5, .26, 7), stoneM); cap.position.set(col.position.x, -0.36 + h + .13, col.position.z); scene.add(cap);
      if (i % 2 === 0){
        const fl = new THREE.Sprite(glowM.clone()); fl.position.set(cap.position.x, cap.position.y + .55, cap.position.z); fl.scale.set(1.6, 2.2, 1); scene.add(fl);
        const core = new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:C(0xffe2a0), transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, fog:false }));
        core.position.copy(fl.position).y -= .15; core.scale.set(.7, 1, 1); scene.add(core);
        flames.push({ fl, core, ph:Math.random() * 10 });
      }
    }
    // luzes
    scene.add(new THREE.HemisphereLight(C(0x8d8aa8), C(0x3d2616), .55));
    moon = new THREE.DirectionalLight(C(0xd2d8ea), 1.25); moon.position.set(-6, 15, 7);
    if (TIER.shadow){
      moon.castShadow = true; moon.shadow.mapSize.set(TIER.shadow, TIER.shadow);
      const sc = moon.shadow.camera; sc.left = -7; sc.right = 7; sc.top = 7; sc.bottom = -7; sc.near = 2; sc.far = 40;
      moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.025;
    }
    scene.add(moon, moon.target);
    const warm = new THREE.DirectionalLight(C(0xff8a40), .55); warm.position.set(8, 4, -6); scene.add(warm);
    for (const [x, z] of [[9, 7], [-9, -7]]){ const L = new THREE.PointLight(C(0xff8a3a), 1.4, 22, 2); L.position.set(x, 3.2, z); scene.add(L); braziers.push(L); }
    fxLight = new THREE.PointLight(C(0xffffff), 0, 9, 2); fxLight.position.set(0, 2, 0); scene.add(fxLight);
    buildEmbers();
    markers();
  }
  // brasas e faíscas subindo (todo o movimento no shader: custo de CPU zero)
  function buildEmbers(){
    const N = TIER.embers, pos = new Float32Array(N * 3), seed = new Float32Array(N * 4);
    for (let i = 0; i < N; i++){
      const a = Math.random() * Math.PI * 2, r = 2 + Math.pow(Math.random(), .7) * 16;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.random() * 9; pos[i * 3 + 2] = Math.sin(a) * r;
      seed[i * 4] = .25 + Math.random() * .7; seed[i * 4 + 1] = Math.random() * 100; seed[i * 4 + 2] = .5 + Math.random() * 1.6; seed[i * 4 + 3] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    embers = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
      uniforms:{ t:{ value:0 }, tex:{ value:glowTex }, px:{ value:1 }, boost:{ value:1 } },
      vertexShader:`attribute vec4 seed; uniform float t; uniform float px; uniform float boost; varying float vA; varying float vH;
        void main(){ vec3 p = position; float sp = seed.x * (0.8 + boost * 0.4); float y = mod(p.y + t * sp, 9.0);
          p.y = y - 0.3; p.x += sin(t * 0.6 + seed.y) * 0.5 * seed.z; p.z += cos(t * 0.5 + seed.y * 1.3) * 0.5 * seed.z;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          float life = y / 9.0; vA = smoothstep(0.0, 0.08, life) * (1.0 - life) * (0.55 + 0.45 * sin(t * 6.0 * seed.z + seed.y)); vH = seed.w;
          gl_PointSize = px * (2.0 + seed.z * 2.6) * (12.0 / -mv.z); }`,
      fragmentShader:`uniform sampler2D tex; varying float vA; varying float vH; void main(){ vec4 c = texture2D(tex, gl_PointCoord); vec3 col = mix(vec3(1.0, 0.55, 0.18), vec3(1.0, 0.85, 0.5), vH); gl_FragColor = vec4(col * c.a * vA * 1.4, c.a * vA); }`,
    }));
    embers.frustumCulled = false; scene.add(embers);
  }
  // casas do último lance (como a marcação da transmissão)
  function markers(){
    const m = new THREE.MeshBasicMaterial({ color:C(0xe3a548), transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false });
    for (let i = 0; i < 2; i++){ const q = new THREE.Mesh(new THREE.PlaneGeometry(.96, .96), m.clone()); q.rotation.x = -Math.PI / 2; q.position.y = .004; scene.add(q); lastMarks.push(q); }
  }
  function markMove(from, to){
    [from, to].forEach((sq, i) => { const q = lastMarks[i]; q.position.copy(sqPos(sq, .004)); q.material.opacity = 0; tween(.4, k => { q.material.opacity = (i ? .28 : .16) * k; }); });
  }

  /* ---------- peças ---------- */
  const TINT_MUL = { hex:0x5a3a3a, k:2.3 }, TINT_EMIS = 0x180306;
  function tinted(T, m){
    let t = T.tint.get(m);
    if (!t){ t = m.clone(); if (t.color) t.color.multiply(C(TINT_MUL.hex).multiplyScalar(TINT_MUL.k)); if (t.emissive) t.emissive.copy(C(TINT_EMIS)); T.tint.set(m, t); }
    return t;
  }
  function applyTint(T, obj){ obj.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(m => tinted(T, m)) : tinted(T, o.material); }); }
  function cloneOf(T, side){
    const model = T.rigged ? THREE.SkeletonUtils.clone(T.scene) : T.scene.clone(true);
    model.rotation.y = T.yaw;
    if (side === 'b') applyTint(T, model);
    const inner = new THREE.Group(); inner.scale.set(T.s, T.sy, T.s); inner.position.copy(T.off); inner.add(model);
    return { inner, model };
  }
  let blobGeo = null, blobMat = null;
  function blob(root, r){
    if (TIER.shadow) return;
    if (!blobGeo){ blobGeo = new THREE.CircleGeometry(1, 20); blobMat = new THREE.MeshBasicMaterial({ map:glowTex, color:0x000000, transparent:true, opacity:.55, depthWrite:false }); }
    const b = new THREE.Mesh(blobGeo, blobMat); b.rotation.x = -Math.PI / 2; b.position.y = .006; b.scale.setScalar(r); root.add(b);
  }
  // anel de luz sob a peça, na cor do lado (como no jogo: âmbar da Aurora, carmesim da Legião)
  let ringGeo = null; const ringMat = {};
  function sideRing(root, side, r){
    if (!ringGeo){
      const c = mkCanvas(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 30, 64, 64, 62);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.55, 'rgba(255,255,255,.9)'); gr.addColorStop(.7, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c);
      ringGeo = new THREE.PlaneGeometry(2, 2);
      ringMat.w = new THREE.MeshBasicMaterial({ map:t, color:C(0xffa040), transparent:true, opacity:.55, blending:THREE.AdditiveBlending, depthWrite:false });
      ringMat.b = new THREE.MeshBasicMaterial({ map:t, color:C(0xff2a3c), transparent:true, opacity:.5, blending:THREE.AdditiveBlending, depthWrite:false });
    }
    const m = new THREE.Mesh(ringGeo, ringMat[side]); m.rotation.x = -Math.PI / 2; m.position.y = .008; m.scale.setScalar(r); root.add(m);
  }
  // instância de uma peça: root (casa e giro) > inner (escala/offset do modelo) > modelo
  function makePiece(type, side, sq, vis){
    vis = vis || type;
    const root = new THREE.Group(), P = { type, vis, side, sq, root, mixer:null, acts:{}, cur:null, T:null, alive:true, face:side === 'w' ? Math.PI : 0 };
    if (vis === 'r'){
      const B = TPL.rb, A = TPL.ra;
      const b = cloneOf(B, side); root.add(b.inner);
      if (A){
        const a = cloneOf(A, side), holder = new THREE.Group(); holder.position.y = B.height * 0.97; holder.add(a.inner); root.add(holder);
        P.T = A; P.mixer = new THREE.AnimationMixer(a.model); P.holder = holder; P.animModel = a.model;
      }
      P.height = B.height * 0.97 + (A ? A.height : 0);
    } else {
      const T = TPL[vis], c = cloneOf(T, side); root.add(c.inner); P.T = T; P.height = T.height; P.inner = c.inner;
      if (T.rigged){ P.mixer = new THREE.AnimationMixer(c.model); P.animModel = c.model; }
    }
    blob(root, vis === 'n' || vis === 'D' ? .55 : .38);
    sideRing(root, side, vis === 'n' || vis === 'D' ? .62 : .44);
    root.position.copy(sqPos(sq)); root.rotation.y = P.face;
    scene.add(root);
    if (P.mixer) play(P, 'idle', { t:Math.random() * 3 });
    return P;
  }
  function clipOf(P, name){ return P.T && P.T.clips ? P.T.clips[name] : null; }
  // troca de clipe com fusão; once = toca uma vez e segura a última pose
  function play(P, name, o = {}){
    if (!P.mixer) return null;
    const clip = clipOf(P, name) || (o.fallback && clipOf(P, o.fallback));
    if (!clip) return null;
    let a = P.acts[clip.uuid];
    if (!a){ a = P.acts[clip.uuid] = P.mixer.clipAction(clip); }
    a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.timeScale = o.speed || (P.vis === 'D' && name === 'idle' ? .35 : 1);
    if (o.once){ a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(THREE.LoopRepeat, Infinity);
    if (o.t) a.time = o.t % clip.duration;
    a.play();
    if (P.cur && P.cur !== a) P.cur.crossFadeTo(a, o.fade == null ? .25 : o.fade, false);
    P.cur = a; P.curName = clip.name;
    return a;
  }
  const idle = P => { if (P.mixer && P.alive) play(P, 'idle', { fade:.35 }); };
  function removePiece(P){ P.alive = false; scene.remove(P.root); if (P.mixer) P.mixer.stopAllAction(); }

  /* ---------- tempo da simulação: espera, interpolação, câmera lenta ---------- */
  let simT = 0, speed = 1;
  const waiters = [], tweens = [];
  const sleep = s => new Promise(res => waiters.push({ t:simT + s, res }));
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  function tween(dur, fn, e){ return new Promise(res => { const tw = { t0:simT, dur:Math.max(.001, dur), fn, e:e || ease, res }; fn(0, 0); tweens.push(tw); }); }
  function stepTime(dt){
    simT += dt;
    for (let i = tweens.length - 1; i >= 0; i--){ const w = tweens[i], k = Math.min(1, (simT - w.t0) / w.dur); w.fn(w.e(k), k); if (k >= 1){ tweens.splice(i, 1); w.res(); } }
    for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].t <= simT){ const w = waiters.splice(i, 1)[0]; w.res(); }
  }
  async function slowmo(k, dur){ speed = k; await sleep(dur * k); speed = 1; }

  /* ---------- efeitos procedurais ---------- */
  const fx = [];
  function sprite(color, size, pos, o = {}){
    const m = new THREE.SpriteMaterial({ map:o.smoke ? smokeTex : glowTex, color:C(color), transparent:true, opacity:o.op == null ? 1 : o.op, blending:o.smoke ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite:false });
    const s = new THREE.Sprite(m); s.scale.setScalar(size); s.position.copy(pos); scene.add(s);
    const f = { s, life:o.life || .6, t:0, vel:o.vel || new THREE.Vector3(), grow:o.grow || 0, op:m.opacity, grav:o.grav || 0, drag:o.drag == null ? 1 : o.drag, size };
    fx.push(f); return f;
  }
  function stepFx(dt){
    for (let i = fx.length - 1; i >= 0; i--){
      const f = fx[i]; f.t += dt;
      if (f.t >= f.life){ scene.remove(f.s); f.s.material.dispose(); fx.splice(i, 1); continue; }
      const k = f.t / f.life;
      f.vel.y -= f.grav * dt; f.vel.multiplyScalar(Math.pow(f.drag, dt * 60));
      f.s.position.addScaledVector(f.vel, dt);
      f.s.scale.setScalar(f.size * (1 + f.grow * k));
      f.s.material.opacity = f.op * (1 - k) * Math.min(1, k * 8 + .2);
    }
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rv = k => new THREE.Vector3(rnd(-k, k), rnd(-k, k), rnd(-k, k));
  function burst(pos, color, n, o = {}){
    n = Math.round(n * (tierName === 'low' ? .5 : 1));
    for (let i = 0; i < n; i++) sprite(color, rnd(.06, .16) * (o.big || 1), pos, { life:rnd(.4, .9), vel:rv(o.v || 2.4).add(new THREE.Vector3(0, o.up || 1.4, 0)), grav:o.grav == null ? 3 : o.grav, drag:.96 });
    sprite(color, (o.big || 1) * 1.6, pos, { life:.35, grow:1.4, op:.9 });
  }
  function smoke(pos, color, n, o = {}){
    n = Math.round(n * (tierName === 'low' ? .5 : 1));
    for (let i = 0; i < n; i++) sprite(color, rnd(.5, 1) * (o.big || 1), pos.clone().add(rv(.25)), { smoke:true, life:rnd(1.2, 2.2), vel:rv(.5).add(new THREE.Vector3(0, rnd(.2, .7), 0)), grow:rnd(1, 2.2), op:(o.op || .5) * .7, drag:.98 });
  }
  function lightPulse(pos, color, peak, dur){
    fxLight.position.copy(pos).y += .6; fxLight.color.set(color);
    return tween(dur, k => { fxLight.intensity = peak * (k < .15 ? k / .15 : 1 - (k - .15) / .85); }, x => x);
  }
  function shake(amt, dur){ cam.shake = Math.max(cam.shake, amt); cam.shakeT = dur; }
  const chest = P => P.root.position.clone().add(new THREE.Vector3(0, Math.min(P.height * .62, 1.2), 0));
  // projétil em arco (ou reto), com rastro
  function fly(from, to, dur, o = {}){
    const obj = o.mesh || null, arc = o.arc || 0, col = o.color || 0xffffff, head = o.head ? sprite(col, o.head, from, { life:dur + .05 }) : null;
    if (obj) scene.add(obj);
    let lastTrail = 0;
    return tween(dur, (k, raw) => {
      const p = from.clone().lerp(to, k); p.y += Math.sin(Math.PI * k) * arc;
      if (obj){ const q = from.clone().lerp(to, Math.min(1, k + .02)); q.y += Math.sin(Math.PI * Math.min(1, k + .02)) * arc; obj.position.copy(p); if (o.spin) obj.rotation.x -= .45; else obj.lookAt(q); }
      if (head){ head.s.position.copy(p); head.t = 0; }
      if (o.trail && simT - lastTrail > .02){ lastTrail = simT; sprite(o.trailColor || col, o.trail, p, { life:.35, op:.7 }); }
      if (raw >= 1 && obj) scene.remove(obj);
    }, x => x);
  }
  let SWORD = null, ARROW = null, FLASK = {};
  function swordMesh(){
    if (!SWORD){
      SWORD = new THREE.Group();
      const steel = new THREE.MeshStandardMaterial({ color:C(0xc9ced6), metalness:.9, roughness:.25, envMap:envTex, envMapIntensity:1.4 }), gold = new THREE.MeshStandardMaterial({ color:C(0xd8a540), metalness:.9, roughness:.3, envMap:envTex });
      const blade = new THREE.Mesh(new THREE.BoxGeometry(.05, .62, .014), steel); blade.position.y = .3; SWORD.add(blade);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(.2, .03, .04), gold); SWORD.add(guard);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .14, 6), gold); grip.position.y = -.08; SWORD.add(grip);
    }
    const g = new THREE.Group(); const s = SWORD.clone(); s.rotation.z = Math.PI / 2; g.add(s); return g;
  }
  function arrowMesh(fire){
    if (!ARROW){
      ARROW = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .5, 4), new THREE.MeshBasicMaterial({ color:C(0x7a5a3a) })); shaft.rotation.x = Math.PI / 2; ARROW.add(shaft);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(.022, .07, 5), new THREE.MeshBasicMaterial({ color:C(0xd8dde4) })); tip.rotation.x = Math.PI / 2; tip.position.z = .27; ARROW.add(tip);
    }
    const a = ARROW.clone();
    if (fire){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:C(0xff7a20), blending:THREE.AdditiveBlending, transparent:true, depthWrite:false })); s.scale.setScalar(.35); s.position.z = .25; a.add(s); }
    return a;
  }
  function flaskMesh(color){
    if (!FLASK[color]){
      const g = new THREE.Group(), glass = new THREE.MeshStandardMaterial({ color:C(color), emissive:C(color), emissiveIntensity:.8, roughness:.2, transparent:true, opacity:.9 });
      const b = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), glass); g.add(b);
      const n = new THREE.Mesh(new THREE.CylinderGeometry(.02, .025, .07, 6), new THREE.MeshStandardMaterial({ color:C(0x6b4a2b) })); n.position.y = .08; g.add(n);
      FLASK[color] = g;
    }
    const g = FLASK[color].clone(), s = new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color:C(color), blending:THREE.AdditiveBlending, transparent:true, depthWrite:false })); s.scale.setScalar(.45); g.add(s);
    return g;
  }
  function boltLine(from, to, color, dur){
    const N = 14, g = new THREE.BufferGeometry(), arr = new Float32Array(N * 3); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color:C(color), transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
    scene.add(line);
    const top = from.clone();
    return tween(dur, (k, raw) => {
      for (let i = 0; i < N; i++){ const t = i / (N - 1), p = top.clone().lerp(to, t); if (i && i < N - 1) p.add(rv(.18)); arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; }
      g.attributes.position.needsUpdate = true; line.material.opacity = 1 - k * .7;
      if (raw >= 1){ scene.remove(line); g.dispose(); line.material.dispose(); }
    }, x => x);
  }
  function slashArc(P, color){
    const c = chest(P), dir = new THREE.Vector3(Math.sin(P.root.rotation.y), 0, Math.cos(P.root.rotation.y));
    for (let i = 0; i < 9; i++){ const a = -1 + i / 4; const p = c.clone().addScaledVector(dir, .35).add(new THREE.Vector3(Math.cos(P.root.rotation.y) * a * .3, a * .25, -Math.sin(P.root.rotation.y) * a * .3)); sprite(color, .22, p, { life:.25 + i * .02, op:.8 }); }
  }
  // impacto conforme o golpe (o que a vítima sofre)
  function impactFx(golpe, at, elem){
    const [g1, g2] = ELEM[elem] || [0xfff0d0, 0xffb347];
    if (golpe === 'explosao'){ burst(at, 0xffb347, 30, { big:1.6, v:3.4 }); smoke(at, 0x2a221c, 9, { big:1.3, op:.7 }); lightPulse(at, 0xff8a30, 18, .7); shake(.18, .5); flash(); }
    else if (golpe === 'veneno'){ smoke(at, 0x6fcf5a, 12, { big:1, op:.4 }); burst(at, 0x9cff7a, 12, { v:1.2, up:.6 }); lightPulse(at, 0x7bcf7f, 6, 1); }
    else if (golpe.startsWith('magia') || golpe === 'sopro'){ burst(at, g2, 26, { big:1.2, v:2.6 }); sprite(g1, 2.2, at, { life:.4, grow:1 }); lightPulse(at, g2, 14, .6);
      if (elem === 'gelo') for (let i = 0; i < 8; i++) sprite(0xe8f8ff, .12, at, { life:.9, vel:rv(2.6).add(new THREE.Vector3(0, 1.6, 0)), grav:5 });
      if (elem === 'fogo' || golpe === 'sopro') smoke(at, 0x3a2418, 5, { op:.5 }); }
    else if (golpe === 'investida'){ burst(at, 0xffd8a0, 18, { v:2 }); smoke(at.clone().setY(.1), 0x3a3128, 7, { op:.5 }); shake(.12, .35); }
    else { burst(at, 0xfff0d0, 16, { v:2.2 }); sprite(0xffffff, .9, at, { life:.18, grow:1 }); lightPulse(at, 0xffe0b0, 6, .35); }
  }

  /* ---------- narrador (Web Audio, cortando o silêncio das pontas) ---------- */
  const audio = { on:false, ctx:null, gain:null, music:null, musicGain:null, buf:new Map(), falas:null, queue:Promise.resolve(), cur:null, playing:false };
  async function loadFalas(){ try { const r = await fetch(DATA + 'narracao.json'); if (r.ok) audio.falas = (await r.json()).falas; } catch (e){} }
  const fala = k => (audio.falas && audio.falas[k] && audio.falas[k].texto) || '';
  function trim(b){
    const d = b.getChannelData(0), th = .012; let s = 0, e = d.length - 1;
    while (s < e && Math.abs(d[s]) < th) s++;
    while (e > s && Math.abs(d[e]) < th) e--;
    s = Math.max(0, s - Math.floor(b.sampleRate * .02)); e = Math.min(d.length - 1, e + Math.floor(b.sampleRate * .04));
    const out = audio.ctx.createBuffer(b.numberOfChannels, e - s + 1, b.sampleRate);
    for (let c = 0; c < b.numberOfChannels; c++) out.copyToChannel(b.getChannelData(c).subarray(s, e + 1), c);
    return out;
  }
  async function getBuf(k){
    if (audio.buf.has(k)) return audio.buf.get(k);
    const p = fetch(ASSETS + 'audio/narr/' + k + '.mp3').then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(k))).then(a => new Promise((res, rej) => audio.ctx.decodeAudioData(a, res, rej))).then(trim).catch(() => null);
    audio.buf.set(k, p); return p;
  }
  // em sequência: os pedaços são tocados emendados; lances comuns são pulados se o narrador estiver falando
  function narrate(keys, major){
    if (!audio.on || !audio.ctx) return;
    if (!major && audio.playing) return;
    if (major && audio.cur){ try { audio.cur.stop(); } catch (e){} }
    const bufs = keys.map(getBuf);
    audio.playing = true;
    const token = audio.token = {};
    (async () => {
      let t = audio.ctx.currentTime + .05;
      for (const bp of bufs){
        const b = await bp; if (!b || audio.token !== token || !audio.on) continue;
        const src = audio.ctx.createBufferSource(); src.buffer = b; src.connect(audio.gain);
        t = Math.max(t, audio.ctx.currentTime + .01); src.start(t); audio.cur = src; t += b.duration + .04;
      }
      const left = Math.max(0, t - audio.ctx.currentTime);
      setTimeout(() => { if (audio.token === token) audio.playing = false; }, left * 1000);
      if (audio.musicGain){ const g = audio.musicGain.gain, n = audio.ctx.currentTime; g.cancelScheduledValues(n); g.setTargetAtTime(.07, n, .1); g.setTargetAtTime(.2, n + left, .6); }
    })();
  }
  function setSound(on){
    audio.on = on;
    if (ui.sound){ ui.sound.setAttribute('aria-pressed', String(on)); ui.sound.setAttribute('aria-label', on ? 'Desligar o som' : 'Ligar o som'); ui.sound.title = on ? 'Desligar o som' : 'Ligar o som'; }
    if (on){
      if (!audio.ctx){
        const AC2 = window.AudioContext || window.webkitAudioContext; if (!AC2) return;
        audio.ctx = new AC2(); audio.gain = audio.ctx.createGain(); audio.gain.gain.value = 1; audio.gain.connect(audio.ctx.destination);
        audio.music = new Audio(ASSETS + 'audio/musica_tema.mp3'); audio.music.loop = true; audio.music.crossOrigin = 'anonymous';
        try { const src = audio.ctx.createMediaElementSource(audio.music); audio.musicGain = audio.ctx.createGain(); audio.musicGain.gain.value = .2; src.connect(audio.musicGain); audio.musicGain.connect(audio.ctx.destination); } catch (e){ audio.music.volume = .2; }
      }
      audio.ctx.resume(); if (!paused) audio.music.play().catch(() => {});
    } else if (audio.ctx){ audio.music.pause(); if (audio.cur){ try { audio.cur.stop(); } catch (e){} } audio.playing = false; }
  }

  /* ---------- câmera de transmissão ---------- */
  const cam = { mode:'orbit', theta:-.35, R:12, H:6.2, pos:null, look:null, tpos:null, tlook:null, focus:null, close:null, shake:0, shakeT:0, k:0, portrait:false };
  function camOrbitTarget(dt){
    cam.theta += dt * .045;
    const R = cam.R * (1 + Math.sin(simT * .07) * .04), H = cam.H + Math.sin(simT * .05) * .5;
    const f = cam.focus || new THREE.Vector3();
    cam.tpos.set(Math.sin(cam.theta) * R + f.x * .25, H, Math.cos(cam.theta) * R + f.z * .25);
    cam.tlook.set(f.x * .35, .3, f.z * .35);
  }
  function cutTo(pos, look, label){
    cam.pos.copy(pos); cam.look.copy(look); cam.tpos.copy(pos); cam.tlook.copy(look);
    if (label) setCam(label);
    flash();
  }
  // close do duelo: do lado da câmera atual, perpendicular à linha entre as peças
  function closeOn(a, b, o = {}){
    const A = a.clone(), B = (b || a).clone(), M = A.clone().add(B).multiplyScalar(.5);
    const d = B.clone().sub(A); d.y = 0; if (d.lengthSq() < 1e-4) d.set(1, 0, 0); d.normalize();
    let n = new THREE.Vector3(-d.z, 0, d.x);
    const toCam = cam.pos.clone().sub(M); toCam.y = 0; if (n.dot(toCam) < 0) n.negate();
    if (o.normal){ n = o.normal.clone().normalize(); d.set(n.z, 0, -n.x); }
    const span = A.distanceTo(B), dist = (o.dist || 3.3) + span * .5 + (cam.portrait ? 2.6 : 0);
    const pos = M.clone().addScaledVector(n, dist).addScaledVector(d, (o.skew || .35) * dist).add(new THREE.Vector3(0, o.h || 2.05, 0));
    const look = M.clone().add(new THREE.Vector3(0, o.lookY || .62, 0));
    cam.mode = 'close'; cam.close = { M, n, d, dist, h:o.h || 2.05, look, drift:(Math.random() < .5 ? -1 : 1) * .05, ang:0 };
    hero.classList.add('is-close');
    cutTo(pos, look, o.label || 'CÂM 3 · DUELO');
  }
  function backToOrbit(){
    stats.phase = 'orbita';
    cam.mode = 'orbit'; cam.close = null; hero.classList.remove('is-close');
    camOrbitTarget(0); cutTo(cam.tpos.clone(), cam.tlook.clone(), 'CÂM 1 · ARENA');
  }
  function updateCamera(dt, dtReal){
    if (cam.mode === 'orbit') camOrbitTarget(dt);
    else if (cam.close){
      const c = cam.close; c.ang += c.drift * dt;
      const n = c.n.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), c.ang);
      cam.tpos.copy(c.M).addScaledVector(n, c.dist * (1 - Math.min(.12, c.ang * c.ang * 2))).addScaledVector(c.d.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), c.ang), .35 * c.dist).add(new THREE.Vector3(0, c.h, 0));
      cam.tlook.copy(c.look);
    }
    // amortecimento (sem ir e voltar): aproximação exponencial
    const k = 1 - Math.exp(-dtReal * (cam.mode === 'orbit' ? 1.6 : 2.4));
    cam.pos.lerp(cam.tpos, k); cam.look.lerp(cam.tlook, k);
    camera.position.copy(cam.pos);
    if (cam.shakeT > 0){ cam.shakeT -= dtReal; camera.position.add(rv(cam.shake * Math.max(0, cam.shakeT) * 2)); }
    camera.lookAt(cam.look);
  }

  /* ---------- tabuleiro e lances ---------- */
  let chess = null, pieces = new Map(), caps = { w:[], b:[] }, cycle = Math.max(0, (+QS.get('ciclo') || 1) - 1);
  const pieceAt = sq => pieces.get(sq);
  function clearBoard(){ for (const P of pieces.values()) removePiece(P); pieces.clear(); caps = { w:[], b:[] }; paintScore(0, 'w'); }
  function setupBoard(){
    clearBoard();
    chess = new Chess();
    const B = chess.board();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++){
      const x = B[r][f]; if (!x) continue;
      const sq = 'abcdefgh'[f] + (8 - r);
      pieces.set(sq, makePiece(x.type, x.color, sq));
    }
  }
  function paintScore(ply, turn){
    if (ui.capsW) ui.capsW.textContent = caps.w.map(t => GLYPH[t]).join('');
    if (ui.capsB) ui.capsB.textContent = caps.b.map(t => GLYPH[t]).join('');
    if (ui.ply) ui.ply.textContent = ply ? Math.ceil(ply / 2) : '—';
    if (ui.score){ ui.score.classList.toggle('bc-turn--w', turn === 'w'); ui.score.classList.toggle('bc-turn--b', turn === 'b'); }
  }
  const sanTxt = m => (m.san.replace(/^([NBRQK])/, (_, p) => SANP[p]).replace('O-O-O', 'O-O-O'));
  const moveTag = (i, m) => `${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'} ${sanTxt(m)}`;

  // deslocamentos com o jeito de cada personagem (README: teleporte do bispo, raio da dama, a torre afunda e brota)
  async function moveVisual(P, to, dur){
    const from = P.root.position.clone(), dest = sqPos(to), vis = P.vis;
    const fy = yawTo(from, dest);
    if (vis === 'b'){
      burst(from.clone().setY(.6), 0xa985ff, 14, { v:1.2, up:1 }); lightPulse(from, 0xa985ff, 5, .5);
      await tween(.25, k => { P.root.scale.set(1 - k * .9, 1 + k * .4, 1 - k * .9); });
      P.root.position.copy(dest); burst(dest.clone().setY(.6), 0xa985ff, 14, { v:1.2, up:1 });
      await tween(.3, k => { P.root.scale.set(.1 + k * .9, 1.4 - k * .4, .1 + k * .9); }, easeOut);
      return;
    }
    if (vis === 'q'){
      const a = from.clone().setY(.8), b = dest.clone().setY(.8);
      boltLine(a, b, 0xbfd8ff, .3); sprite(0xbfd8ff, 1.4, a, { life:.3, grow:1 }); lightPulse(from.clone().lerp(dest, .5), 0x9fc0ff, 7, .4);
      await tween(.12, k => { P.root.scale.setScalar(1 - k * .95); });
      P.root.position.copy(dest); sprite(0xe0ecff, 1.6, b, { life:.35, grow:1.2 });
      await tween(.25, k => { P.root.scale.setScalar(.05 + k * .95); }, easeOut);
      return;
    }
    if (vis === 'r'){
      smoke(from.clone().setY(.1), 0x3a3128, 6, { op:.5 });
      await tween(.35, k => { P.root.position.y = -P.height * k; }, x => x * x);
      P.root.position.set(dest.x, -P.height, dest.z); smoke(dest.clone().setY(.1), 0x3a3128, 6, { op:.5 });
      await tween(.45, k => { P.root.position.y = -P.height * (1 - k); }, easeOut);
      return;
    }
    // a pé ou a galope
    const rot0 = P.root.rotation.y;
    await tween(.18, k => { P.root.rotation.y = lerpAngle(rot0, fy, k); });
    const jump = vis === 'n' || vis === 'D' ? (vis === 'D' ? 1.6 : .9) : 0;
    let walk = null;
    if (P.mixer && clipOf(P, 'walk')) walk = play(P, 'walk', { fade:.15, speed:1.2 });
    if (vis === 'n' && !walk) smoke(from.clone().setY(.1), 0x3a3128, 4, { op:.4 });
    await tween(dur, k => {
      P.root.position.lerpVectors(from, dest, k);
      P.root.position.y = jump ? Math.sin(Math.PI * k) * jump : (walk ? 0 : Math.abs(Math.sin(k * Math.PI * 3)) * .06);
      if (jump && P.inner) P.root.rotation.x = Math.sin(k * Math.PI * 2) * -.12;
    });
    P.root.rotation.x = 0; P.root.position.copy(dest);
    if (vis === 'n') smoke(dest.clone().setY(.1), 0x3a3128, 4, { op:.4 });
    if (walk) idle(P);
    const r1 = P.root.rotation.y;
    await tween(.22, k => { P.root.rotation.y = lerpAngle(r1, P.face, k); });
  }
  function lerpAngle(a, b, k){ let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; }
  async function turnTo(P, yaw, dur){ const r = P.root.rotation.y; await tween(dur, k => { P.root.rotation.y = lerpAngle(r, yaw, k); }); }

  // clipe de ataque conforme o golpe; sem o clipe certo, o ataque padrão do personagem
  function attackClip(P, golpe){
    const v = P.vis;
    if (v === 'p' && golpe === 'arremesso' && clipOf(P, 'Over_Shoulder_Throw')) return 'Over_Shoulder_Throw';
    if ((golpe === 'explosao' || golpe === 'veneno' || (v === 'p' && golpe.startsWith('magia'))) && v !== 'r' && clipOf(P, 'Crouch_Charge_and_Throw')) return 'Crouch_Charge_and_Throw';
    return 'attack';
  }
  function deathClip(V, golpe){
    const want = DEATH[golpe.split(':')[0]] || 'dying_backwards';
    return clipOf(V, want) ? want : 'death';
  }
  // a vítima cai: com rig, o clipe de morte; sem rig (cavaleiro montado, base da torre), tomba e afunda
  async function die(V, golpe, fromYaw){
    const clip = deathClip(V, golpe);
    const long = /Electrocuted|Strangled/.test(clip);
    if (V.mixer) play(V, clip, { once:true, fade:.12, speed:long ? 1.7 : 1.05, fallback:'death' });
    if (V.vis === 'n' || V.vis === 'D' || V.vis === 'r'){
      const side = Math.random() < .5 ? 1 : -1, r0z = V.root.rotation.z;
      if (V.vis === 'r'){ smoke(V.root.position.clone().setY(.4), 0x5a4c40, 10, { big:1.2, op:.6 }); await sleep(.6); }
      await tween(.9, k => { V.root.rotation.z = r0z + side * k * (V.vis === 'r' ? .35 : 1.25); V.root.position.y = -k * (V.vis === 'r' ? .3 : .15); }, x => x * x);
    } else await sleep(long ? 2.1 : 1.5);
    // a terra recolhe o corpo (sem trocar materiais, que são compartilhados)
    const p = V.root.position.clone(), y0 = p.y;
    burst(p.clone().setY(.15), 0xff9a3c, 14, { v:1, up:1.2 });
    await tween(.9, k => { V.root.position.y = y0 - k * (V.height + .5); }, x => x * x);
    removePiece(V);
  }

  async function duel(A, V, m, i){
    stats.phase = 'duelo';
    const golpe = A.vis === 'D' ? 'sopro' : (MATRIX[A.vis] && MATRIX[A.vis][V.type]) || 'lamina';
    const [kind, elem] = golpe.split(':');
    const melee = kind === 'lamina' || kind === 'investida';
    const aPos = A.root.position.clone(), vPos = V.root.position.clone();
    const tall = Math.max(0, Math.max(A.height, V.height) - 1.3);
    closeOn(aPos, vPos, { label:'CÂM 3 · DUELO', dist:3.3 + tall * 1.7, h:2.05 + tall * .9, lookY:.62 + tall * .45 });
    const who = A.vis === 'p' && A.lanceiro ? 'L' : A.vis;
    setCaption(`${cap1(NAME[who] || NAME[A.type])} captura ${NAME[V.vis] || NAME[V.type]} em <b>${m.to}</b> <small>· ${GOLPE_NOME[golpe] || golpe}</small>`, moveTag(i, m), 'Duelo');
    narrate([`s_${who === 'D' ? 'n' : who}_captura`, `o_${V.vis === 'D' ? 'n' : V.type}`, `em_${m.to}`], true);
    await sleep(.35);
    const yawAV = yawTo(aPos, vPos);
    await Promise.all([turnTo(A, yawAV, .3), V.vis !== 'r' ? turnTo(V, yawAV + Math.PI, .3) : sleep(.3)]);
    // aproximação no corpo a corpo
    if (melee){
      const stop = vPos.clone().add(aPos.clone().sub(vPos).setY(0).normalize().multiplyScalar(A.vis === 'n' ? .95 : .72));
      let w = A.mixer && clipOf(A, 'walk') ? play(A, 'walk', { fade:.12, speed:1.4 }) : null;
      if (kind === 'investida' || A.vis === 'n') smoke(aPos.clone().setY(.1), 0x3a3128, 6, { op:.45 });
      await tween(kind === 'investida' ? .45 : .5, k => { A.root.position.lerpVectors(aPos, stop, k); if (!w && A.vis !== 'n') A.root.position.y = Math.abs(Math.sin(k * Math.PI * 2)) * .05; });
      if (w) idle(A);
    }
    // golpe
    let hitAt = .5;
    if (A.mixer && A.vis !== 'D'){
      const cn = attackClip(A, golpe), clip = clipOf(A, cn) || clipOf(A, 'attack');
      const sp = A.vis === 'r' ? 1.7 : /Crouch_Charge/.test(clip && clip.name || '') ? 1.6 : 1.15;
      play(A, cn, { once:true, fade:.1, speed:sp, fallback:'attack' });
      hitAt = clip ? Math.min(impactOf(A.T, clip, A.vis === 'r' ? .42 : /Crouch_Charge/.test(clip.name) ? .62 : null) / sp, 2.2) : .5;
    } else if (A.vis === 'n'){
      const r0 = A.root.rotation.x, p0 = A.root.position.clone(), dir = vPos.clone().sub(p0).setY(0).normalize();
      tween(.55, k => { const s = Math.sin(k * Math.PI); A.root.rotation.x = r0 - s * .28; A.root.position.copy(p0).addScaledVector(dir, s * .25); A.root.position.y = s * .2; });
      hitAt = .3;
    } else if (A.vis === 'D'){
      const r0 = A.root.rotation.x; tween(1.1, k => { A.root.rotation.x = r0 - Math.sin(k * Math.PI) * .22; }); hitAt = .35;
    }
    if (kind === 'lamina' || kind === 'investida'){
      await sleep(hitAt);
      slashArc(A, kind === 'investida' ? 0xffd8a0 : 0xfff0d0);
    } else {
      // à distância: projétil sai da mão, voa e acerta
      await sleep(Math.max(.05, hitAt - .05));
      const from = chest(A).add(new THREE.Vector3(Math.sin(yawAV) * .3, A.vis === 'r' ? .1 : .15, Math.cos(yawAV) * .3)), to = chest(V);
      const dist = from.distanceTo(to), dur = Math.min(.8, .25 + dist * .07);
      if (kind === 'flecha'){ for (let k = 0; k < 3; k++){ fly(from.clone().add(rv(.05)), to.clone().add(rv(.12)), dur, { mesh:arrowMesh(false), arc:.5 + k * .12 }); await sleep(.08); } }
      else if (kind === 'arremesso'){ fly(from, to, dur + .1, { mesh:A.vis === 'n' ? arrowMesh(false) : swordMesh(), arc:.6, spin:A.vis !== 'n', trail:.12, trailColor:0xfff0d0 }); }
      else if (kind === 'explosao'){ fly(from, to, dur + .15, A.vis === 'r' ? { mesh:arrowMesh(true), arc:.8, trail:.2, trailColor:0xff7a20 } : { mesh:flaskMesh(0xff8a30), arc:1, trail:.12, trailColor:0xffb347 }); }
      else if (kind === 'veneno'){ fly(from, to, dur + .15, A.vis === 'r' ? { mesh:arrowMesh(false), arc:.7, trail:.14, trailColor:0x7bcf7f } : { mesh:flaskMesh(0x6fdc5a), arc:1, trail:.12, trailColor:0x7bcf7f }); }
      else if (kind === 'sopro'){
        const head = A.root.position.clone().add(new THREE.Vector3(Math.sin(yawAV) * .6, A.height * .55, Math.cos(yawAV) * .6));
        lightPulse(head, 0xff6a1e, 12, 1.2);
        for (let k = 0; k < 18; k++){ fly(head.clone(), to.clone().add(rv(.25)), .4, { head:.5 + Math.random() * .4, color:k % 3 ? 0xff6a1e : 0xffd08a }); await sleep(.04); }
      } else {
        const [c1, c2] = ELEM[elem] || ELEM.arcano;
        if (elem === 'raio'){ boltLine(from.clone().add(new THREE.Vector3(0, 2.5, 0)), to, c1, .35); boltLine(from, to, c2, .3); }
        else fly(from, to, dur, { head:.55, color:c2, trail:.22, trailColor:c1 });
        lightPulse(from, c2, 8, dur + .1);
      }
      await sleep(kind === 'sopro' ? .1 : dur + (kind === 'flecha' ? -.1 : 0));
    }
    const hit = chest(V);
    impactFx(kind === 'magia' ? 'magia' : kind, hit, elem || (kind === 'sopro' ? 'fogo' : null));
    caps[A.side].push(V.type); paintScore(i + 1, A.side === 'w' ? 'b' : 'w');
    const dying = die(V, golpe, yawAV);
    slowmo(.45, .5);
    await sleep(V.vis === 'n' || V.vis === 'r' ? 1.3 : 1.1);
    if (A.mixer && A.vis !== 'D') idle(A);
    await dying;
    // o vencedor ocupa a casa
    pieces.delete(m.from); pieces.set(m.to, A); A.sq = m.to;
    const at = A.root.position.clone(), dest = sqPos(m.to);
    if (at.distanceTo(dest) > .05){
      const w = A.mixer && clipOf(A, 'walk') ? play(A, 'walk', { fade:.15 }) : null;
      await tween(.45, k => { A.root.position.lerpVectors(at, dest, k); A.root.position.y = A.vis === 'D' ? Math.sin(Math.PI * k) * .6 : 0; });
      if (w) idle(A);
    }
    A.root.position.copy(dest);
    await turnTo(A, A.face, .3);
    await sleep(.25);
    backToOrbit();
  }

  async function ply(i){
    const m = chess.move(OPERA[i]);
    if (!m) return;
    stats.ply = i + 1;
    markMove(m.from, m.to);
    const P = pieceAt(m.from); if (!P) return;
    cam.focus = sqPos(m.to);
    const turn = m.color === 'w' ? 'b' : 'w';
    if (m.flags.includes('c') || m.flags.includes('e')){
      const V = pieceAt(m.to);
      if (V) await duel(P, V, m, i);
    } else if (m.flags.includes('k') || m.flags.includes('q')){
      const long = m.flags.includes('q'), rank = m.color === 'w' ? '1' : '8', rf = (long ? 'a' : 'h') + rank, rt = (long ? 'd' : 'f') + rank, R = pieceAt(rf);
      setCaption(fala(long ? 'e_roque_grande' : 'e_roque_pequeno') || 'Roque!', moveTag(i, m), 'Arena das Cinzas');
      narrate([long ? 'e_roque_grande' : 'e_roque_pequeno'], true);
      await Promise.all([moveVisual(P, m.to, .9), R ? moveVisual(R, rt, .9) : null]);
      pieces.delete(m.from); pieces.set(m.to, P); P.sq = m.to;
      if (R){ pieces.delete(rf); pieces.set(rt, R); R.sq = rt; }
    } else {
      const who = P.lanceiro ? 'L' : P.vis === 'D' ? 'D' : P.type;
      setCaption(`${cap1(NAME[who])} avança para <b>${m.to}</b>`, moveTag(i, m), 'Arena das Cinzas');
      narrate([`s_${who === 'D' ? 'n' : who}_avanca`, `casa_${m.to}`]);
      await moveVisual(P, m.to, P.vis === 'n' || P.vis === 'D' ? .75 : .7);
      pieces.delete(m.from); pieces.set(m.to, P); P.sq = m.to;
    }
    paintScore(i + 1, turn);
    if (chess.in_checkmate()) return;
    if (chess.in_check()){
      const K = [...pieces.values()].find(x => x.type === 'k' && x.side === turn);
      if (K){ const p = K.root.position.clone().setY(.05); for (let k = 0; k < 10; k++) sprite(0xd24a58, .35, p.clone().add(new THREE.Vector3(Math.cos(k / 10 * 6.28) * .45, 0, Math.sin(k / 10 * 6.28) * .45)), { life:.9, op:.8 }); lightPulse(p, 0xd24a58, 6, .8); }
      setTimeout(() => { if (ui.caption) ui.caption.firstElementChild.innerHTML += ' <small>· xeque!</small>'; }, 220);
      narrate(['e_xeque'], false);
    }
    await sleep(.55);
  }

  // transmutação: círculo de runas, partículas em espiral, clarão e troca do modelo
  async function transmute(P, toVis, o = {}){
    if (!P || !P.alive || !TPL[toVis === 'r' ? 'rb' : toVis]) return false;
    stats.phase = 'transmutacao:' + toVis;
    const pos = P.root.position.clone();
    closeOn(pos, pos.clone().add(new THREE.Vector3(.01, 0, 0)), { normal:new THREE.Vector3(Math.sin(P.face), 0, Math.cos(P.face)), skew:.3, dist:2.9 + (toVis === 'D' ? 1.6 : 0), h:2.9 + (toVis === 'D' ? .6 : 0), lookY:.75, label:'CÂM 2 · TRANSMUTAÇÃO' });
    setCaption(o.caption, o.tag || 'Transmutação', 'Pausa teatral');
    if (o.narr) narrate([o.narr], true);
    const color = o.color || 0xe3a548;
    const circle = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map:runeTex, color:C(color), transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false }));
    circle.rotation.x = -Math.PI / 2; circle.position.copy(pos).setY(.02); scene.add(circle);
    await tween(.7, k => { circle.material.opacity = k * .95; circle.scale.setScalar(.3 + k * .9); circle.rotation.z += .04; });
    const spin = setInterval(() => { for (let k = 0; k < 3; k++){ const a = Math.random() * 6.28, r = .55 + Math.random() * .4; sprite(color, .14, pos.clone().add(new THREE.Vector3(Math.cos(a) * r, .05, Math.sin(a) * r)), { life:1.1, vel:new THREE.Vector3(-Math.sin(a) * .6, 1.6 + Math.random(), Math.cos(a) * .6) }); } }, 40);
    lightPulse(pos, color, 10, 1.6);
    await tween(1.1, k => { circle.rotation.z += .06 + k * .1; P.root.position.y = Math.sin(k * Math.PI * .5) * .35; P.root.rotation.y += .02 + k * .12; });
    clearInterval(spin);
    flash(); burst(pos.clone().setY(.8), 0xffffff, 26, { big:1.4, v:3 }); sprite(color, 3.2, pos.clone().setY(.8), { life:.5, grow:1.2 });
    // troca do modelo
    const N = makePiece(P.type, P.side, P.sq, toVis);
    N.lanceiro = toVis === 'L';
    N.root.position.copy(pos).setY(.35); N.root.scale.setScalar(.01); N.root.rotation.y = P.root.rotation.y;
    removePiece(P); pieces.set(P.sq, N);
    await tween(.55, k => { N.root.scale.setScalar(.01 + k * 1.05); N.root.position.y = .35 * (1 - k); }, easeOut);
    await tween(.2, k => { N.root.scale.setScalar(1.06 - k * .06); });
    await turnTo(N, N.face, .4);
    if (N.mixer && clipOf(N, 'attack') && toVis !== 'D'){ play(N, 'attack', { once:true, speed:1.2 }); setTimeout(() => idle(N), 1400); }
    await tween(.6, k => { circle.material.opacity = .95 * (1 - k); circle.rotation.z += .05; });
    scene.remove(circle); circle.geometry.dispose(); circle.material.dispose();
    await sleep(.9);
    backToOrbit();
    await sleep(.4);
    return true;
  }

  // xeque-mate: o rei negro se ajoelha, é levado para o campo das brancas, e os vencedores comemoram
  async function mateScene(){
    const K = [...pieces.values()].find(x => x.type === 'k' && x.side === 'b');
    const winners = [...pieces.values()].filter(x => x.side === 'w' && x.alive && (x.type === 'k' || x.type === 'b' || x.lanceiro || x.type === 'r'));
    if (!K) return;
    stats.phase = 'mate';
    const kp = K.root.position.clone();
    closeOn(kp, kp.clone().add(new THREE.Vector3(.01, 0, 0)), { normal:new THREE.Vector3(.35, 0, 1), skew:.2, dist:3.1, h:2.4, lookY:.8, label:'CÂM 4 · XEQUE-MATE' });
    setCaption(`<b>Xeque-mate!</b> ${fala('e_mate_brancas').replace(/^Xeque-mate!\s*/, '') || 'O rei negro é capturado e levado para o campo das brancas!'}`, '17. ♖d8#', 'Fim de partida');
    narrate(['e_mate_brancas'], true);
    if (ui.stamp){ ui.stamp.hidden = false; ui.stamp.classList.remove('go'); void ui.stamp.offsetWidth; ui.stamp.classList.add('go'); }
    lightPulse(kp, 0xd24a58, 10, 1.2);
    await turnTo(K, 0, .3);
    const kneel = K.mixer && clipOf(K, 'Kneel_on_One_Knee_and_Stand');
    if (kneel){ const a = play(K, 'Kneel_on_One_Knee_and_Stand', { once:true, fade:.2 }); await sleep(kneel.duration * .42); if (a) a.paused = true; }
    else await tween(.8, k => { K.root.rotation.x = k * .35; K.root.position.y = -k * .2; });
    await slowmo(.5, .8);
    // correntes de luz e o transporte
    const ring = []; for (let k = 0; k < 16; k++){ const a = k / 16 * 6.28; ring.push(sprite(0xffd08a, .25, kp.clone().add(new THREE.Vector3(Math.cos(a) * .5, .5, Math.sin(a) * .5)), { life:2.4, op:.9 })); }
    lightPulse(kp, 0xffd08a, 12, 2.2);
    await sleep(.9);
    const dest = new THREE.Vector3(0, 0, 5.4), from = K.root.position.clone();
    setCam('CÂM 1 · ARENA'); cam.mode = 'orbit'; cam.close = null; hero.classList.remove('is-close');
    cam.focus = new THREE.Vector3(0, 0, 2);
    await tween(1.8, k => { K.root.position.lerpVectors(from, dest, k); K.root.position.y = Math.sin(Math.PI * k) * 1.4 + (kneel ? 0 : -.2); K.root.rotation.y = k * Math.PI * 2; for (const r of ring){ r.s.position.lerp(K.root.position.clone().setY(K.root.position.y + .5), .2); } });
    burst(dest.clone().setY(.4), 0xffd08a, 26, { big:1.3 });
    // comemoração dos vencedores
    for (const W of winners){ if (W.mixer && clipOf(W, 'cheer')) play(W, 'cheer', { fade:.2 }); else if (W.mixer && clipOf(W, 'attack')) play(W, 'attack', { once:true }); }
    embers.material.uniforms.boost.value = 3;
    setCaption('As brancas vencem em 17 lances. <small>Morphy, Ópera de Paris, 1858</small>', 'Resultado', 'Aurora 1 · 0 Legião');
    await sleep(4.2);
    embers.material.uniforms.boost.value = 1;
    if (ui.stamp) ui.stamp.hidden = true;
  }

  async function intro(){
    setupBoard();
    cam.focus = null; backToOrbit();
    const all = [...pieces.values()];
    all.forEach(P => { P.root.position.y = -P.height - .2; });
    setCaption('Partida da Ópera, Paris 1858: <b>Paul Morphy</b> contra o Duque de Brunswick e o Conde Isouard', 'Ao vivo', 'Arena das Cinzas');
    for (let r = 0; r < 4; r++){
      for (const P of all.filter(P => P.sq[1] === ['1', '8', '2', '7'][r])){
        const y0 = P.root.position.y;
        tween(.7, k => { P.root.position.y = y0 * (1 - k); }, easeOut);
        if (Math.random() < .5) burst(P.root.position.clone().setY(.1), 0xff9a3c, 4, { v:.8, up:1 });
      }
      await sleep(.35);
    }
    await sleep(1.4);
  }
  async function outro(){
    if (ui.fade) ui.fade.classList.add('on');
    await sleep(1.2);
    if (ui.fade) ui.fade.classList.remove('on');
  }

  // teste: ?lance=N pula direto para o lance N (sem animação) no primeiro ciclo
  function fastForward(n){
    for (let i = 0; i < n; i++){
      const m = chess.move(OPERA[i]); if (!m) break;
      const P = pieceAt(m.from), V = pieceAt(m.to);
      if (V){ caps[m.color].push(V.type); removePiece(V); }
      if (m.flags.includes('k') || m.flags.includes('q')){ const long = m.flags.includes('q'), rk = m.color === 'w' ? '1' : '8', rf = (long ? 'a' : 'h') + rk, rt = (long ? 'd' : 'f') + rk, R = pieceAt(rf); if (R){ pieces.delete(rf); pieces.set(rt, R); R.sq = rt; R.root.position.copy(sqPos(rt)); } }
      pieces.delete(m.from); pieces.set(m.to, P); P.sq = m.to; P.root.position.copy(sqPos(m.to));
    }
    paintScore(n, n % 2 ? 'b' : 'w');
    return n;
  }
  async function director(){
    for (;;){
      cycle++; stats.cycle = cycle;
      await intro();
      const skip = !stats.skipped ? Math.max(0, Math.min(OPERA.length - 1, +QS.get('lance') || 0)) : 0;
      stats.skipped = true;
      if (skip) fastForward(skip);
      for (let i = skip; i < OPERA.length; i++){
        await ply(i);
        // pausas teatrais
        if (i === 10){ const P = pieceAt('e4'); await transmute(P, 'L', { caption:fala('e_lanceiro') || 'O peão evolui para Lanceiro!', narr:'e_lanceiro', color:0xe3a548 }); }
        if (i === 21){
          const wantDragon = cycle % 2 === 0 && TPL.D;
          if (wantDragon) await transmute(pieceAt('f6'), 'D', { caption:'O cavaleiro desperta como <b>Dragão das Cinzas</b>!', narr:'e_que_lance', color:0xff6a1e });
          else await transmute(pieceAt('h7'), 'q', { caption:'Transmutação! O peão da Legião se torna <b>dama</b>!', narr:'e_promo_q', color:0xa985ff });
        }
      }
      await mateScene();
      await outro();
    }
  }

  /* ---------- laço de quadros, visibilidade, ajuste de qualidade ---------- */
  let raf = 0, last = 0, paused = false, visible = true, started = false, fpsAcc = { n:0, t:0, low:0 };
  function frame(t){
    raf = 0;
    if (!running()) return;
    const dtReal = Math.min(.05, last ? (t - last) / 1000 : .016); last = t;
    const dt = dtReal * speed;
    stepTime(dt); stepFx(dt);
    for (const P of pieces.values()) if (P.mixer) P.mixer.update(dt);
    for (const f of flames){ const s = 1 + Math.sin(simT * 9 + f.ph) * .08 + Math.sin(simT * 23 + f.ph) * .05; f.fl.scale.set(1.6 * s, 2.2 * s, 1); f.core.scale.set(.7 * s, 1, 1); }
    braziers.forEach((L, k) => { L.intensity = 1.3 + Math.sin(simT * 11 + k * 3) * .15 + Math.sin(simT * 27 + k) * .1; });
    if (runeRing) runeRing.rotation.z += dt * .03;
    embers.material.uniforms.t.value = simT; scene.userData.sky.material.uniforms.t.value = simT;
    updateCamera(dt, dtReal);
    renderer.render(scene, camera);
    // fps e degrau de qualidade
    fpsAcc.n++; fpsAcc.t += dtReal;
    if (fpsAcc.t >= 2){
      stats.fps = Math.round(fpsAcc.n / fpsAcc.t);
      if (stats.fps < 40 && !document.hidden) fpsAcc.low++; else fpsAcc.low = 0;
      if (fpsAcc.low >= 2) degrade();
      fpsAcc.n = 0; fpsAcc.t = 0;
    }
    raf = requestAnimationFrame(frame);
  }
  const running = () => started && !paused && visible && !document.hidden;
  function kick(){ if (running() && !raf){ last = 0; raf = requestAnimationFrame(frame); } }
  function degrade(){
    fpsAcc.low = 0;
    const dpr = renderer.getPixelRatio();
    if (dpr > 1.01){ renderer.setPixelRatio(Math.max(1, dpr - .25)); stats.dpr = renderer.getPixelRatio(); resize(); return; }
    if (renderer.shadowMap.enabled){ renderer.shadowMap.enabled = false; moon.castShadow = false; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); stats.shadows = false; return; }
  }
  function resize(){
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h; camera.aspect = aspect;
    cam.portrait = aspect < .9;
    cam.R = aspect >= 1.3 ? 12 : Math.min(30, 12.5 * Math.pow(1.3 / aspect, .9));
    cam.H = aspect >= 1.3 ? 6.2 : 6.6 + (cam.R - 12.5) * .55;
    scene.fog.near = cam.R * 1.05; scene.fog.far = cam.R * 3.2;
    // o tabuleiro fica à direita do texto no computador e acima dele no celular
    if (aspect >= 1.1){ const k = .15; camera.setViewOffset(w * (1 + 2 * k), h, 0, 0, w, h); }
    else { const k = aspect < .7 ? .21 : .14; camera.setViewOffset(w, h * (1 + 2 * k), 0, h * 2 * k, w, h); }
    camera.updateProjectionMatrix();
    if (embers) embers.material.uniforms.px.value = renderer.getPixelRatio() * Math.min(1.4, h / 800);
  }

  function setPaused(p){
    paused = p;
    if (ui.pause){ ui.pause.setAttribute('aria-pressed', String(p)); ui.pause.setAttribute('aria-label', p ? 'Retomar a transmissão' : 'Pausar a transmissão'); ui.pause.title = p ? 'Retomar' : 'Pausar'; ui.pause.innerHTML = p ? ICON.play : ICON.pause; }
    if (audio.ctx){ if (p){ audio.ctx.suspend(); audio.music && audio.music.pause(); } else if (audio.on){ audio.ctx.resume(); audio.music.play().catch(() => {}); } }
    kick();
  }
  const ICON = {
    pause:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>',
    play:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>',
  };

  /* ---------- arranque ---------- */
  function fallback(msg){
    stats.state = 'poster';
    if (ui.progress) ui.progress.style.width = '0';
    setCaption(msg || 'A transmissão 3D não abriu neste navegador. <a href="#" data-game="espectador">Assista no jogo</a>.', 'Pôster', 'Arena das Cinzas');
    if (AC.wireLinks) setTimeout(AC.wireLinks, 200);
  }
  function webglOK(){ try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e){ return false; } }

  async function boot(){
    if (started || stats.state === 'loading') return;
    if (!webglOK()){ fallback(); return; }
    stats.state = 'loading';
    if (ui.start) ui.start.hidden = true;
    setCaption('Preparando a transmissão…', 'Ao vivo', 'Arena das Cinzas');
    try {
      await Promise.all([loadLibs(), loadManifest(), loadFalas()]);
      renderer = new THREE.WebGLRenderer({ canvas, antialias:TIER.aa, powerPreference:'high-performance' });
      if (!renderer.getContext()) throw new Error('sem contexto');
      renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
      renderer.setPixelRatio(Math.min(TIER.dpr, devicePixelRatio || 1)); stats.dpr = renderer.getPixelRatio();
      if (TIER.shadow){ renderer.shadowMap.enabled = true; renderer.shadowMap.type = TIER.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; }
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); started = false; hero.classList.remove('is-live'); fallback('A transmissão foi interrompida pelo navegador.'); });
      buildScene();
      cam.pos = new THREE.Vector3(); cam.look = new THREE.Vector3(); cam.tpos = new THREE.Vector3(); cam.tlook = new THREE.Vector3();
      resize();
      // modelos principais (em paralelo); a partida só começa com todos
      const main = ['p', 'b', 'q', 'k', 'n', 'rb', 'ra'];
      const got = await Promise.all(main.map(k => loadGltf(urlsFor(SPEC[k]), k)));
      main.forEach((k, i) => { if (got[i]) prepTemplate(k, got[i]); });
      if (!main.every(k => TPL[k])) throw new Error('modelos principais ausentes: ' + main.filter(k => !TPL[k]).join(', '));
      if (SPEC.k.walk){ const w = await loadClips('rei/walk.gltf.json'); addClips('k', w, 'walk'); }
      started = true; stats.state = 'live';
      if (ui.progress) ui.progress.style.width = '0';
      hero.classList.add('is-live');
      addEventListener('resize', () => { if (renderer) resize(); });
      kick();
      director().catch(e => { stats.errors.push('diretor: ' + e.message); console.warn(e); });
      // depois, em segundo plano: Lanceiro, golpes, comemoração e (no nível alto) o Dragão
      (async () => {
        const L = await loadGltf(urlsFor(SPEC.L)); if (L) prepTemplate('L', L);
        if (!TIER.extras) return;
        for (const k of ['p', 'ra', 'b', 'k', 'q']){ addClips(k, await loadClips(EXTRA[k] + '/golpes.gltf.json'), 'golpes'); }
        for (const k of ['k', 'b']) addClips(k, await loadClips(EXTRA[k] + '/cheer.gltf.json'), 'cheer');
        if (TIER.dragon && has('dragao/animated.opt.gltf.json')){ const D = await loadGltf(['dragao/animated.opt.gltf.json']); if (D) prepTemplate('D', D); }
      })().catch(e => stats.errors.push('extras: ' + e.message));
    } catch (e){
      console.warn('hero:', e);
      stats.errors.push(String(e && e.message || e));
      hero.classList.remove('is-live');
      fallback();
    }
  }

  // controles
  if (ui.sound) ui.sound.addEventListener('click', () => setSound(!audio.on));
  if (ui.pause){ ui.pause.innerHTML = ICON.pause; ui.pause.addEventListener('click', () => setPaused(!paused)); }
  if (ui.start) ui.start.addEventListener('click', () => { ui.start.hidden = true; boot(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && audio.ctx) audio.ctx.suspend(); else if (!paused && audio.on && audio.ctx) audio.ctx.resume(); kick(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; kick(); }, { threshold:.02 }).observe(hero);

  // começa depois do carregamento da página, no tempo ocioso; com movimento reduzido, só com o clique
  function schedule(){
    if (reduce.matches && QS.get('motion') !== '1'){
      setCaption('Movimento reduzido: a transmissão fica parada. <small>Use o botão para assistir.</small>', 'Pôster', 'Arena das Cinzas');
      if (ui.start) ui.start.hidden = false;
      if (ui.pause) ui.pause.hidden = true;
      return;
    }
    const go = () => (window.requestIdleCallback ? requestIdleCallback(boot, { timeout:1500 }) : setTimeout(boot, 300));
    if (document.readyState === 'complete') go(); else addEventListener('load', go, { once:true });
  }
  schedule();
  window.__hero = { boot, setPaused, setSound, stats, TPL };
})();
