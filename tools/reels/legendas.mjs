// Legendas dos Reels automáticos: varia gancho, corpo, chamada e hashtags conforme o confronto e o resultado.
export const REINOS = {
  'Reino da Aurora': { curto:'Aurora', art:'a', mascote:'o Arcanjo dourado', tags:['#fantasia', '#cavaleiros'] },
  'Legião do Ferro Negro': { curto:'Ferro Negro', art:'o', mascote:'o Deus da Morte', tags:['#darkfantasy', '#rpg'] },
  'Reino dos Dragões': { curto:'Dragões', art:'os', mascote:'o dragão gigante', tags:['#dragao', '#dragon'] },
  'Alpha da Lua Nova': { curto:'Lua Nova', art:'a', mascote:'o lobisomem', tags:['#lobisomem', '#werewolf'] },
  'Clã dos Primatas': { curto:'Primatas', art:'o', mascote:'o ídolo gorila de pedra', tags:['#gorila', '#selva'] },
  'Abismo Estelar': { curto:'Abismo', art:'o', mascote:'a Rainha-Mãe', tags:['#ficcaocientifica', '#scifi'] },
  'Clã do Mar Profundo': { curto:'Mar Profundo', art:'o', mascote:'o Kraken', tags:['#kraken', '#oceano'] },
  'Império do Deserto Subterrâneo': { curto:'Deserto', art:'o', mascote:'o Verme-Colosso', tags:['#deserto', '#escorpiao'] },
};
export const NOMES = Object.keys(REINOS);

const pick = (a, r) => a[Math.floor(r() * a.length)];
const shuffle = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const GANCHOS = [
  'Aqui, xeque-mate não é só fim de jogo. É cena de cinema.',
  'E se cada captura no xadrez virasse uma batalha?',
  'Seu peão nunca mais vai ser só um peão.',
  'Xadrez, mas cada peça luta de verdade.',
  'Assista até o fim: o xeque-mate chega voando.',
  'Duas IAs, um tabuleiro e nenhuma piedade.',
  'Quem disse que xadrez é parado?',
  'Cada captura, um golpe. Cada mate, um filme.',
  'O xeque-mate mais épico que você vai ver hoje.',
  'Xadrez de verdade, regras de verdade, batalha de verdade.',
  'Repara no mapinha: é xadrez clássico, lance por lance.',
  'Isso é uma partida de xadrez. Sério.',
];
const CHAMADAS = [
  'Joga grátis no navegador, sem instalar. Link na bio.',
  'Grátis no celular ou no PC: link na bio.',
  'Quer jogar com o seu reino? Link na bio, sem instalar.',
  'Roda no navegador, de graça. Link na bio.',
];
const PERGUNTAS = [
  'Qual dos 8 reinos você escolheria? Comenta aí ⚔️',
  'Você jogaria com qual lado? Comenta!',
  'Viu o lance no mapinha? Você teria jogado igual?',
  'Quem vence a revanche? Comenta o seu palpite.',
  'Qual reino você quer ver na próxima batalha?',
];
const BASE = ['#xadrez', '#xadrezbrasil', '#xadrezonline', '#xadrez3d', '#chess', '#jogosindie', '#indiegame', '#gamedev', '#jogosgratis', '#jogosdenavegador', '#chesstok', '#jogos'];

// r: gerador 0..1; w/b: nomes completos dos reinos; venc: 'w' | 'b' | null; lances: número de lances
const GANCHOS_ARC = [
  'Modo Arcano: xadrez com cartas de magia, ataque, defesa e terreno.',
  'E se o seu cavalo virasse um Pégaso no meio da partida?',
  'Xadrez + cartas de feitiço. Olha o que acontece.',
  'No Modo Arcano, o tabuleiro também luta.',
];
export function legenda({ w, b, venc, lances, arcano = false, r = Math.random }){
  const W = REINOS[w], B = REINOS[b];
  const vs = `${W.curto} × ${B.curto}`;
  let corpo;
  if (venc){
    const V = venc === 'w' ? W : B, P = venc === 'w' ? B : W;
    corpo = pick([
      `${vs}: ${V.curto} ${V.art === 'os' ? 'vencem' : 'vence'} em ${lances} lances, e ${V.mascote} entra em cena para o xeque-mate.`,
      `${vs}. No fim, ${V.mascote} decide a partida contra ${P.art} ${P.curto}.`,
      `Batalha ${vs}: ${lances} lances até ${V.mascote} aparecer.`,
    ], r);
  } else {
    corpo = pick([
      `${vs}: ${lances} lances de golpes e nenhum vencedor. Empate de gigantes.`,
      `Batalha ${vs} sem coroa: terminou empatada em ${lances} lances.`,
    ], r);
  }
  const tags = [...shuffle(BASE, r).slice(0, arcano ? 6 : 8), ...(arcano ? ['#modoarcano', '#cardgame'] : []), ...W.tags.slice(0, 1), ...B.tags.slice(0, 1)];
  const meio = arcano
    ? 'Modo Arcano: cartas de magia, ataque, defesa e terreno, essência e peças que evoluem. O mapinha no canto mostra cada lance no tabuleiro.'
    : 'Cada peça é um personagem do seu reino e cada captura vira combate. O mapinha no canto mostra o lance no tabuleiro.';
  return [pick(arcano ? GANCHOS_ARC : GANCHOS, r), '', corpo, meio, '',
    pick(CHAMADAS, r), pick(PERGUNTAS, r), '', [...new Set(tags)].join(' ')].join('\n');
}
