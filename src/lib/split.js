/**
 * Bill splitting maths.
 *
 * Pure and side-effect free so it can be tested without a browser — this is
 * the part that decides what people actually pay, so it gets to be the part
 * that is easiest to check.
 *
 * Two things here were wrong in the original app:
 *
 *  1. Service charge and GST were ordinary draggable tiles. Dropped in the
 *     "All" bucket they split evenly, so someone who ordered $3 of rice paid
 *     the same GST as someone who ordered $60 of food. Charges are a
 *     percentage of what you ate, so they are apportioned pro-rata here and
 *     are never assignable.
 *  2. Totals were floats rounded for display, so the per-person amounts did
 *     not add up to the receipt total. Everything below works in integer
 *     cents, and the final rounding uses largest-remainder so the parts sum
 *     to the whole exactly.
 */

/** Categories that are apportioned across everyone rather than assigned. */
const PROPORTIONAL = new Set(["service_charge", "tax", "rounding", "discount"]);

export const isCharge = (item) => PROPORTIONAL.has(item.category);
export const isFood = (item) => !PROPORTIONAL.has(item.category);

export const EVERYONE_ID = "everyone";

export const toCents = (n) => Math.round((Number(n) || 0) * 100);
export const toDollars = (cents) => cents / 100;

export const formatMoney = (cents, currency = "") => {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const body = `${sign}$${(abs / 100).toFixed(2)}`;
  return currency ? `${body} ${currency}` : body;
};

/**
 * Split `totalCents` across `weights` so the parts sum to exactly the total.
 *
 * Plain division leaves stray cents — three people splitting $10.00 each get
 * $3.333, and three times $3.33 is $9.99. Largest-remainder hands the odd
 * cents to whoever was rounded down hardest, which is the fairest tie-break
 * and, more importantly, always adds up.
 */
export function apportion(totalCents, weights) {
  const keys = Object.keys(weights);
  if (keys.length === 0) return {};

  const weightTotal = keys.reduce((sum, k) => sum + weights[k], 0);
  const out = {};

  if (weightTotal <= 0) {
    // Nothing eaten yet (or an all-zero bill): fall back to an even split so
    // charges on an unassigned receipt still show something sensible.
    const base = Math.trunc(totalCents / keys.length);
    let remainder = totalCents - base * keys.length;
    const step = remainder < 0 ? -1 : 1;
    keys.forEach((k) => {
      out[k] = base;
    });
    for (let i = 0; remainder !== 0; i = (i + 1) % keys.length) {
      out[keys[i]] += step;
      remainder -= step;
    }
    return out;
  }

  const remainders = [];
  let allocated = 0;
  keys.forEach((k) => {
    const exact = (totalCents * weights[k]) / weightTotal;
    const floored = Math.floor(exact);
    out[k] = floored;
    allocated += floored;
    remainders.push({ key: k, frac: exact - floored });
  });

  let leftover = totalCents - allocated;
  const step = leftover < 0 ? -1 : 1;
  remainders.sort((a, b) => (step > 0 ? b.frac - a.frac : a.frac - b.frac));
  for (let i = 0; leftover !== 0 && remainders.length; i += 1) {
    out[remainders[i % remainders.length].key] += step;
    leftover -= step;
  }
  return out;
}

/**
 * Every place an item can be dropped: each person individually, any subgroup
 * the user made, and "Everyone". Treating a person as a one-member target
 * removes the special-casing that the original drag handler tripped over.
 */
export function buildTargets(people, groups) {
  const targets = people.map((p) => ({
    id: p.id,
    name: p.name,
    memberIds: [p.id],
    kind: "person",
  }));
  groups.forEach((g) => {
    const memberIds = g.memberIds.filter((id) => people.some((p) => p.id === id));
    if (memberIds.length > 1) {
      targets.push({ id: g.id, name: g.name, memberIds, kind: "group" });
    }
  });
  if (people.length > 0) {
    targets.push({
      id: EVERYONE_ID,
      name: "Everyone",
      memberIds: people.map((p) => p.id),
      kind: "everyone",
    });
  }
  return targets;
}

/**
 * Work out what each person owes.
 *
 * @returns {{
 *   perPerson: Array<{id, name, foodCents, chargeCents, totalCents}>,
 *   unassigned: Array<object>,
 *   foodCents: number, chargeCents: number, totalCents: number,
 *   receiptTotalCents: number|null, reconciles: boolean
 * }}
 */
export const CHARGE_MODES = {
  PROPORTIONAL: "proportional",
  EQUAL: "equal",
};

export function computeSplit({
  items = [],
  people = [],
  groups = [],
  assignments = {},
  receiptTotal = null,
  chargeMode = CHARGE_MODES.PROPORTIONAL,
}) {
  const targets = buildTargets(people, groups);
  const targetById = new Map(targets.map((t) => [t.id, t]));

  // Exact fractional cents first, rounded once at the very end.
  //
  // Rounding each item as it is assigned looked fine but quietly favoured one
  // person: ties in the remainder always broke in the same order, so whoever
  // sorted first collected the spare cent on *every* item. Three shared items
  // put them 3c ahead; a fifteen-line bill would be 10-15c. Accumulating the
  // exact shares and rounding once caps the whole residue at a single cent.
  const exactFood = {};
  people.forEach((p) => {
    exactFood[p.id] = 0;
  });

  const unassigned = [];
  let assignedFoodCents = 0;

  items.filter(isFood).forEach((item) => {
    const target = targetById.get(assignments[item.id]);
    if (!target || target.memberIds.length === 0) {
      unassigned.push(item);
      return;
    }
    const cents = toCents(item.lineTotal);
    assignedFoodCents += cents;
    // Sharing a dish means sharing it equally.
    const share = cents / target.memberIds.length;
    target.memberIds.forEach((id) => {
      exactFood[id] = (exactFood[id] || 0) + share;
    });
  });

  const foodCentsByPerson = apportion(assignedFoodCents, exactFood);

  const chargeCents = items
    .filter(isCharge)
    .reduce((sum, item) => sum + toCents(item.lineTotal), 0);

  // Two defensible ways to handle service charge and tax:
  //   proportional — you pay tax on what you ordered (the restaurant's own
  //                  arithmetic, and the fairer default)
  //   equal        — everyone pays the same share of the extras
  // While nothing is assigned yet the proportional weights are all zero and
  // apportion() falls back to an even split, so the summary is never blank.
  const chargeWeights =
    chargeMode === "equal"
      ? Object.fromEntries(people.map((p) => [p.id, 1]))
      : foodCentsByPerson;
  const chargeByPerson = apportion(chargeCents, chargeWeights);

  const perPerson = people.map((p) => {
    const food = foodCentsByPerson[p.id] || 0;
    const charge = chargeByPerson[p.id] || 0;
    return {
      id: p.id,
      name: p.name,
      foodCents: food,
      chargeCents: charge,
      totalCents: food + charge,
    };
  });

  const foodCents = items
    .filter(isFood)
    .reduce((sum, item) => sum + toCents(item.lineTotal), 0);
  const receiptTotalCents =
    receiptTotal === null || receiptTotal === undefined ? null : toCents(receiptTotal);

  return {
    perPerson,
    unassigned,
    foodCents,
    assignedFoodCents,
    chargeCents,
    totalCents: foodCents + chargeCents,
    receiptTotalCents,
    reconciles:
      receiptTotalCents === null ||
      Math.abs(receiptTotalCents - (foodCents + chargeCents)) < 1,
  };
}
