 // ===== OverGrid Phase 17 — Independent Verifier =====

import {
  createState,
  tick,
  hashWorldState
} from "./core.js";

export function verifyLedger({ initialEntities, envelopes, ledger }) {

  if (!Array.isArray(envelopes) || !Array.isArray(ledger))
    return { valid: false, divergenceIndex: -1 };

  if (envelopes.length !== ledger.length)
    return { valid: false, divergenceIndex: -1 };

  let state = createState(initialEntities);

  for (let i = 0; i < envelopes.length; i++) {

    const env = envelopes[i];

    if (env.tick !== state.tick)
      return { valid: false, divergenceIndex: i };

    state = tick(state, env);

    const expectedHash = hashWorldState(state);
    const ledgerEntry = ledger[i];

    if (!ledgerEntry ||
        ledgerEntry.stateHash !== expectedHash)
      return { valid: false, divergenceIndex: i };
  }

  return { valid: true };
}