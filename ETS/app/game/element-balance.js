// Element cycle used for strengths and weaknesses during battle.
// Water beats Fire, Fire beats Electric, Electric beats Water.
const BEATS = Object.freeze({ water: 'fire', fire: 'electro', electro: 'water' });

export function elementAdvantage(attacker, defender) {
  if (BEATS[attacker] === defender) return 1;
  if (BEATS[defender] === attacker) return -1;
  return 0;
}
