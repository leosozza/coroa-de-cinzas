// Glicko-2 (Glickman, "Example of the Glicko-2 system", 2013). Cada partida é um período de avaliação com um só resultado;
// antes dela, o desvio cresce com o tempo parado (1 período = 1 dia), até o teto de 350.
export const START = { r:1500, rd:350, vol:0.06 };
const SCALE = 173.7178, TAU = 0.5, EPS = 1e-6, RD_MAX = 350, RD_MIN = 45, DAY = 86400000;

const g = phi => 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI));
const E = (mu, muj, phij) => 1 / (1 + Math.exp(-g(phij) * (mu - muj)));

// desvio aumentado pelos dias sem jogar
export function aged(p, now = Date.now()){
  const days = p.updated ? Math.max(0, (now - p.updated) / DAY) : 0;
  const phi = p.rd / SCALE, phiStar = Math.sqrt(phi * phi + days * p.vol * p.vol);
  return { ...p, rd:Math.min(RD_MAX, phiStar * SCALE) };
}

// p = { r, rd, vol }, games = [{ r, rd, score }] (score 1, 0,5 ou 0)
export function rate(p, games){
  const mu = (p.r - 1500) / SCALE, phi = p.rd / SCALE, sigma = p.vol;
  if (!games.length){
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return { r:p.r, rd:Math.min(RD_MAX, phiStar * SCALE), vol:sigma };
  }
  let vInv = 0, dSum = 0;
  for (const o of games){
    const muj = (o.r - 1500) / SCALE, phij = o.rd / SCALE, e = E(mu, muj, phij), gj = g(phij);
    vInv += gj * gj * e * (1 - e);
    dSum += gj * (o.score - e);
  }
  const v = 1 / vInv, delta = v * dSum;
  // nova volatilidade pelo método de Illinois (passo 5 do artigo)
  const a = Math.log(sigma * sigma);
  const f = x => { const ex = Math.exp(x), d2 = phi * phi + v + ex; return (ex * (delta * delta - phi * phi - v - ex)) / (2 * d2 * d2) - (x - a) / (TAU * TAU); };
  let A = a, B;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else { let k = 1; while (f(a - k * TAU) < 0) k++; B = a - k * TAU; }
  let fA = f(A), fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > EPS; i++){
    const C = A + (A - B) * fA / (fB - fA), fC = f(C);
    if (fC * fB <= 0){ A = B; fA = fB; } else fA /= 2;
    B = C; fB = fC;
  }
  const sigma2 = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi * phi + sigma2 * sigma2);
  const phi2 = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const mu2 = mu + phi2 * phi2 * dSum;
  return { r:mu2 * SCALE + 1500, rd:Math.max(RD_MIN, Math.min(RD_MAX, phi2 * SCALE)), vol:sigma2 };
}

// uma partida entre dois jogadores; scoreA = 1, 0,5 ou 0 do ponto de vista de A
export function duel(a, b, scoreA, now = Date.now()){
  const A = aged(a, now), B = aged(b, now);
  return [rate(A, [{ r:B.r, rd:B.rd, score:scoreA }]), rate(B, [{ r:A.r, rd:A.rd, score:1 - scoreA }])];
}

// ligas do plano (05/11/2026). Grão-Mestre Arcano: os 500 primeiros do ranking (exige nota firme e conta)
export const LEAGUES = [
  { id:'aprendiz', name:'Aprendiz', min:0 },
  { id:'alquimista', name:'Alquimista', min:1200 },
  { id:'mestre', name:'Mestre Arcano', min:1500 },
  { id:'inquisidor', name:'Inquisidor da Aurora', min:1800 },
];
export const GRANDMASTER = { id:'grao-mestre', name:'Grão-Mestre Arcano', top:500 };
export const PROVISIONAL_RD = 110;
export function league(r, rank = null, eligibleTop = false){
  if (eligibleTop && rank != null && rank <= GRANDMASTER.top) return GRANDMASTER;
  let L = LEAGUES[0];
  for (const x of LEAGUES) if (r >= x.min) L = x;
  return L;
}
