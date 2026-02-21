// ===== Deterministic Time Controller (Phase 17 Compatible) =====

import { combatStillPossible } from "./core.js";

export class DeterministicTimeController {

  constructor(executor, maxTicks) {
    this.executor = executor;
    this.maxTicks = maxTicks;
  }

  run(frameProducer) {

    let ticks = 0;

    while (
      ticks < this.maxTicks &&
      combatStillPossible(this.executor.getSnapshot())
    ) {

      const tick = this.executor.getTick();
      const frameId = tick;

      const envelope = frameProducer(
        this.executor.getSnapshot(),
        tick,
        frameId
      );

      this.executor.submitFrame(envelope);

      ticks++;
    }

    return ticks;
  }
}