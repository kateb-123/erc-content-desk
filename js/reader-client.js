/**
 * Sort's catch-up: reads every row still waiting for the reader before any
 * card is shown (Kate, Sep 10). /api/read takes a batch per call, so this
 * loops until nothing is left, and stops the moment a call reads nothing, so
 * a row that keeps failing cannot hold Sort forever.
 */
export async function readAllWaiting(ids, post, onProgress) {
  let read = 0, failed = 0;
  if (!ids.length) return { read, failed };
  for (;;) {
    const reply = await post(ids);
    read += reply?.read ?? 0;
    failed += reply?.failed ?? 0;
    onProgress?.(read);
    if (!reply?.read || !reply?.left) return { read, failed };
  }
}
