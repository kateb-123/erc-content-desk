/**
 * Run async work a few items at a time.
 *
 * Bulk upload used to post one item, wait for Claude to read it, wait for the
 * sheet write, and only then start the next — about four minutes for thirty
 * items. Six in flight cuts that to under a minute.
 *
 * It never rejects: one item that blows up must not take the other twenty-nine
 * with it, so every slot resolves to {ok:true, value} or {ok:false, error} in
 * the caller's original order.
 */
export async function runPool(items, limit, worker, onProgress) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;

  const runner = async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      try {
        results[i] = { ok: true, value: await worker(items[i], i) };
      } catch (error) {
        results[i] = { ok: false, error };
      }
      done += 1;
      onProgress?.(done, items.length);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, runner),
  );
  return results;
}
