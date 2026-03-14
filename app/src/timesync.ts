import { syncTimeWithOffset } from "./nixie.js";
import { log } from "./utils.js";

let timer: NodeJS.Timeout | null = null;
let currentOffset = 0; // hours

/**
 * Start pushing current time (with tz offset applied) to the clock every second.
 * Calling this again with a new offset will restart the loop.
 */
export function startTimeSync(tzOffsetHours: number): void {
  currentOffset = tzOffsetHours;

  if (timer) {
    clearInterval(timer);
    log.debug("timesync restarted with offset", tzOffsetHours);
  } else {
    log.info(
      `⏱  Time sync started (offset: ${tzOffsetHours >= 0 ? "+" : ""}${tzOffsetHours}h)`,
    );
  }

  // Push immediately, then every second
  void push();
  timer = setInterval(() => void push(), 1_000);
}

export function stopTimeSync(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    log.info("⏱  Time sync stopped");
  }
}

export function getCurrentOffset(): number {
  return currentOffset;
}

async function push(): Promise<void> {
  try {
    await syncTimeWithOffset(currentOffset);
  } catch (err) {
    // Don't spam logs — one warn per failure is enough
    log.warn("timesync push failed:", (err as Error).message);
  }
}
