// NTP-style server clock estimation so countdowns and timed games agree across devices.
let offset = 0;
let bestRtt = Infinity;
const samples: { rtt: number; offset: number; at: number }[] = [];

export function serverNow(): number {
  return Date.now() + offset;
}

export function clockRtt(): number {
  return Number.isFinite(bestRtt) ? bestRtt : 100;
}

export function addClockSample(sentAt: number, serverTime: number, receivedAt: number): void {
  const rtt = receivedAt - sentAt;
  if (rtt < 0 || rtt > 5000) return;
  const off = serverTime - (sentAt + receivedAt) / 2;
  samples.push({ rtt, offset: off, at: receivedAt });
  while (samples.length > 10) samples.shift();
  // use the lowest-latency sample (least asymmetric), smoothed
  const best = samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
  bestRtt = best.rtt;
  offset = samples.length === 1 ? best.offset : offset * 0.5 + best.offset * 0.5;
}

/** Hint from server-stamped messages (used before any ping completes). */
export function hintServerTime(serverTime: number): void {
  if (samples.length === 0) offset = serverTime - Date.now();
}
