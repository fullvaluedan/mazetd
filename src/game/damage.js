// =============================================================================
// damage.js — the WC3-style damage-type vs armor-type matchup matrix.
//
// matchup() is consulted on every hit (Enemy.takeDamage) and when scaling a
// poison DoT at application time. strongWeak() derives the strong/weak armor
// lists for a damage type so the UI can render counter badges without any
// hardcoded strings — both read CONFIG.DAMAGE_VS_ARMOR, the single source.
// =============================================================================

import { CONFIG } from '../config.js';

// Multiplier for a damage type hitting an armor type. Unknown types (ad-hoc
// stats objects, old saves) are neutral 1.0.
export function matchup(damageType, armorType) {
  const row = CONFIG.DAMAGE_VS_ARMOR[damageType];
  return (row && row[armorType] != null) ? row[armorType] : 1;
}

// { strong: [armorTypeId...], weak: [armorTypeId...] } for UI badges.
// Thresholds live in CONFIG.MATRIX_BADGES; names/colors in CONFIG.ARMOR_TYPES.
export function strongWeak(damageType) {
  const row = CONFIG.DAMAGE_VS_ARMOR[damageType] || {};
  const strong = [], weak = [];
  for (const [a, m] of Object.entries(row)) {
    if (m >= CONFIG.MATRIX_BADGES.strong) strong.push(a);
    else if (m <= CONFIG.MATRIX_BADGES.weak) weak.push(a);
  }
  return { strong, weak };
}
