/**
 * An interval that keeps its pace in a background tab. Browsers slow normal
 * timers on hidden tabs to once a second, then once a minute, which would
 * delay a new-order sound for a tab that is open but not in front. A
 * worker's timer isn't slowed the same way, so it does the counting.
 */
export function setBackgroundInterval(callback: () => void, ms: number): () => void {
  try {
    const source = `setInterval(() => postMessage(0), ${Math.max(250, Math.floor(ms))});`;
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.onmessage = () => callback();
    return () => worker.terminate();
  } catch {
    const id = setInterval(callback, ms);
    return () => clearInterval(id);
  }
}
