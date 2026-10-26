export const RUN_DURATION_SECONDS = 60;
export const MIN_ARMY = 1;
export const ARMY_VISUAL_CAP = 30;
export const MIN_BOSS_ARMY = 10;
export const MIN_BOSS_LEVEL = 5;
export const SAFE_REWARD_INTERVAL = 4;

export const ELEMENT_TYPES = Object.freeze(['fire', 'water', 'electro']);

export const REQUIRED_ELEMENT_PER_ARENA = Object.freeze({
  city: 'fire',
  forest: 'water',
  cyber: 'electro',
  robot: 'electro'
});

const BOSS_ELEMENT = Object.freeze({
  city: 'electro',
  forest: 'fire',
  cyber: 'water',
  robot: 'water'
});

export function applyMinusGate(currentArmy, minusAmount) {
  return Math.max(MIN_ARMY, currentArmy - minusAmount);
}

export function pickBalancedElement(history = [], randomValue = Math.random()) {
  const recent = history.slice(-2);
  const available = ELEMENT_TYPES.filter((element) => !recent.includes(element));
  const candidates = available.length ? available : ELEMENT_TYPES;
  const index = Math.min(candidates.length - 1, Math.floor(randomValue * candidates.length));
  return candidates[index];
}

export function isSafeRewardStation(recycledStationCount) {
  return recycledStationCount > 0 && recycledStationCount % SAFE_REWARD_INTERVAL === 0;
}

export function calculateBossTarget({ armyCount = 1, level = 1, elementType = 'fire' } = {}, arenaType = 'city', elementAdvantage) {
  const bossElement = BOSS_ELEMENT[arenaType] || BOSS_ELEMENT.city;
  const requiredElement = REQUIRED_ELEMENT_PER_ARENA[arenaType] || REQUIRED_ELEMENT_PER_ARENA.city;
  const isCorrectElement = (elementType === requiredElement);
  const advantage = isCorrectElement ? 1 : elementAdvantage(elementType, bossElement);
  const baseTarget = Math.max(
    180,
    300 - Math.min(90, (Math.max(MIN_ARMY, armyCount) - 1) * 5) - Math.min(30, (Math.max(1, level) - 1) * 10)
  );
  const multiplier = isCorrectElement ? 0.8 : 1.35;

  return {
    targetExp: Math.ceil(baseTarget * multiplier),
    advantage,
    bossElement,
    requiredElement,
    isCorrectElement
  };
}

export function calculateBossDamage({ armyCount = 1, level = 1, exp = 0, elementType } = {}, advantage = 0, arenaType = 'city') {
  const required = REQUIRED_ELEMENT_PER_ARENA[arenaType] || REQUIRED_ELEMENT_PER_ARENA.city;
  const armyPower = Math.round(Math.sqrt(Math.max(MIN_ARMY, armyCount)) * 55);
  const levelPower = Math.max(1, level) * 40;
  const expPower = Math.floor(Math.max(0, exp) / 50) * 25;

  let elementMultiplier = advantage > 0 ? 1.25 : advantage < 0 ? 0.78 : 1;
  // Jika elemen salah, serangan tidak berdaya melawan Boss
  if (elementType && elementType !== required) {
    elementMultiplier = 0.15;
  }

  return Math.max(10, Math.round((100 + armyPower + levelPower + expPower) * elementMultiplier));
}

export function canDefeatBoss({ armyCount = 1, level = 1, exp = 0, elementType } = {}, targetExp = 0, arenaType = 'city') {
  const required = REQUIRED_ELEMENT_PER_ARENA[arenaType] || REQUIRED_ELEMENT_PER_ARENA.city;
  // Wajib memakai elemen yang sesuai arena; jika pindah ke elemen lain, pasti kalah!
  if (elementType !== required) {
    return false;
  }
  return armyCount >= MIN_BOSS_ARMY && level >= MIN_BOSS_LEVEL && exp >= targetExp;
}

export function getBossMaxHp(arenaType = 'city') {
  if (arenaType === 'forest') return 14000;
  if (arenaType === 'cyber' || arenaType === 'robot') return 16000;
  return 12000;
}

