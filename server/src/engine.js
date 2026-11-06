// O motor do jogo (engine/arcano-rules.js, sem cópia) e o catálogo, numa instância só para a sala, a fila e o replay.
import arcanoRules from '../../engine/arcano-rules.js';
import catalog from '../../data/cartas.json' with { type:'json' };

export const ARC = arcanoRules(catalog.cartas);
export const CATALOG = catalog.cartas;
export const DECK_IDS = Object.keys(ARC.DECKS);
// carimbo das regras com que a partida foi gravada: versão do estado do motor + custos e tipos das cartas.
// O replay roda o motor atual; se o carimbo mudou, o cliente avisa que o replay pode divergir.
let h = 0;
for (const c of catalog.cartas.map(c => c.id + ':' + c.custo + ':' + c.tipo).sort().join('|')) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
export const RULES = ARC.create({ seed:1, pure:true }).v + ':' + h.toString(36);
