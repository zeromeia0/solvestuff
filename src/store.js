import fs from 'node:fs/promises';
import path from 'node:path';

// A tiny JSON-file "database". Reads are cached in memory; writes are
// serialized and atomic (write to .tmp, then rename) so a crash never
// leaves a half-written file behind.
export function createJsonStore(file, fallback) {
  let cache = null;
  let queue = Promise.resolve();

  async function save() {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(cache, null, 2));
    await fs.rename(tmp, file);
  }

  async function get() {
    if (cache) return cache;
    try {
      cache = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      cache = structuredClone(fallback);
      await save();
    }
    return cache;
  }

  // fn receives the data and may mutate it; validate before mutating.
  function update(fn) {
    const run = queue.then(async () => {
      const data = await get();
      const result = await fn(data);
      await save();
      return result;
    });
    queue = run.catch(() => {});
    return run;
  }

  return { get, update };
}
