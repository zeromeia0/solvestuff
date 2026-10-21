import fs from 'node:fs/promises';

// Parses Matematica_Sequencia_de_Ensino.md into
// { parts: [{ title, blocks: [{ title, items: [{ id, text, refs, programme }] }] }] }.
// Item ids are the numbers from the file, so renumbering the file shifts saved progress.

const TEX = [
  [/\\mathbb\s*R/g, 'ℝ'],
  [/\\mathbb\s*N/g, 'ℕ'],
  [/\\mathbb\s*Z/g, 'ℤ'],
  [/\\mathbb\s*Q/g, 'ℚ'],
  [/\\mathbb\s*C/g, 'ℂ'],
  [/\^2/g, '²'],
  [/\^3/g, '³'],
];

function plain(value) {
  return value.replace(/\$([^$]*)\$/g, (_, tex) => TEX.reduce((s, [re, to]) => s.replace(re, to), tex));
}

// An item belongs to one programme only when it carries a single AE tag at its end,
// e.g. "Lógica … — AE2018" or "Bolzano … (AE2023)". Mid-text tags mark only part of the topic.
function programmeOf(text) {
  const tags = text.match(/AE20(18|23)/g) ?? [];
  if (tags.length !== 1) return null;
  return /(?:—\s*|\()AE20(?:18|23)\)?$/.test(text) ? tags[0] : null;
}

export function parseSequence(markdown) {
  const parts = [];
  for (const line of markdown.split('\n')) {
    let m;
    if ((m = /^# (Parte .+)$/.exec(line))) {
      parts.push({ title: m[1].trim(), blocks: [] });
    } else if ((m = /^## \d+\.\s+(.+)$/.exec(line)) && parts.length) {
      parts.at(-1).blocks.push({ title: m[1].trim(), items: [] });
    } else if ((m = /^(\d+)\.\s+(.+)$/.exec(line)) && parts.at(-1)?.blocks.length) {
      let text = m[2].trim();
      let refs = '';
      const tail = /\s*\(([BS][\d.]+(?:,\s*[BS][\d.]+)*)\)$/.exec(text);
      if (tail) {
        refs = tail[1];
        text = text.slice(0, tail.index);
      }
      text = plain(text);
      parts.at(-1).blocks.at(-1).items.push({ id: m[1], text, refs, programme: programmeOf(text) });
    }
  }
  return { parts: parts.filter((p) => p.blocks.length) };
}

export async function loadSequence(file) {
  try {
    return parseSequence(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    console.warn(`Teaching sequence not found at ${file}; the students checklist will be empty.`);
    return { parts: [] };
  }
}
