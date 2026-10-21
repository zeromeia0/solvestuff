import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createJsonStore } from './store.js';
import { loadSequence } from './sequence.js';
import { HttpError, sendJson, readJson } from './http.js';

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const PROGRAMMES = ['', 'AE2018', 'AE2023'];
const TOPIC_STATUSES = ['learning', 'known', 'review'];

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function text(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function bilingual(pt, en, max) {
  return { pt: text(pt, max), en: text(en, max) };
}

function findLevel(curriculum, levelId) {
  const level = curriculum.levels.find((l) => l.id === levelId);
  if (!level) throw new HttpError(404, 'level_not_found');
  return level;
}

function findTopic(level, topicId) {
  const topic = level.topics.find((t) => t.id === topicId);
  if (!topic) throw new HttpError(404, 'topic_not_found');
  return topic;
}

// Multipart parsing via the web-standard Request.formData(), with a hard
// byte limit so a huge upload can't exhaust memory.
async function readForm(req, maxBytes) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > maxBytes) throw new HttpError(413, 'file_too_large');
  let size = 0;
  let tooLarge = false;
  async function* limited() {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxBytes) {
        tooLarge = true;
        throw new Error('too large');
      }
      yield chunk;
    }
  }
  const request = new Request('http://local/upload', {
    method: 'POST',
    headers: { 'content-type': req.headers['content-type'] || '' },
    body: Readable.toWeb(Readable.from(limited())),
    duplex: 'half',
  });
  try {
    return await request.formData();
  } catch {
    throw new HttpError(tooLarge ? 413 : 400, tooLarge ? 'file_too_large' : 'invalid_form');
  }
}

export async function createApi({ storageDir, seedFile, sequenceFile, adminPassword }) {
  const uploadsDir = path.join(storageDir, 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });
  const seed = JSON.parse(await fs.readFile(seedFile, 'utf8'));
  const curriculum = createJsonStore(path.join(storageDir, 'curriculum.json'), seed);
  const sheets = createJsonStore(path.join(storageDir, 'sheets.json'), { sheets: [] });
  const students = createJsonStore(path.join(storageDir, 'students.json'), { students: [] });
  const sequence = await loadSequence(sequenceFile);
  const sequenceIds = new Set(sequence.parts.flatMap((p) => p.blocks.flatMap((b) => b.items.map((i) => i.id))));
  const sessions = new Map(); // token -> expiresAt
  const passwordHash = crypto.createHash('sha256').update(adminPassword).digest();

  function requireAdmin(req) {
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
    const expires = match && sessions.get(match[1]);
    if (!expires || expires < Date.now()) {
      if (match) sessions.delete(match[1]);
      throw new HttpError(401, 'unauthorized');
    }
  }

  async function sortedSheets(filter) {
    const { levels } = await curriculum.get();
    const rank = new Map();
    levels.forEach((level, li) =>
      level.topics.forEach((topic, ti) => rank.set(`${level.id}/${topic.id}`, li * 1000 + ti)),
    );
    const { sheets: all } = await sheets.get();
    return all
      .filter((s) => (!filter.level || s.level === filter.level) && (!filter.topic || s.topic === filter.topic))
      .sort(
        (a, b) =>
          (rank.get(`${a.level}/${a.topic}`) ?? 1e9) - (rank.get(`${b.level}/${b.topic}`) ?? 1e9) ||
          a.createdAt.localeCompare(b.createdAt),
      );
  }

  async function getSheet(id) {
    const { sheets: all } = await sheets.get();
    const sheet = all.find((s) => s.id === id);
    if (!sheet) throw new HttpError(404, 'sheet_not_found');
    return sheet;
  }

  async function validateSheetFields(fields, current = {}) {
    const level = fields.level ?? current.level;
    const topic = fields.topic ?? current.topic;
    findTopic(findLevel(await curriculum.get(), level), topic);
    const title = bilingual(fields.titlePt ?? current.title?.pt, fields.titleEn ?? current.title?.en, 160);
    if (!title.pt && !title.en) throw new HttpError(400, 'title_required');
    const description = bilingual(
      fields.descriptionPt ?? current.description?.pt,
      fields.descriptionEn ?? current.description?.en,
      600,
    );
    return { level, topic, title, description };
  }

  function findStudent(data, id) {
    const student = data.students.find((s) => s.id === id);
    if (!student) throw new HttpError(404, 'student_not_found');
    return student;
  }

  function studentFields(body, current = {}) {
    const name = text(body.name ?? current.name, 80);
    if (!name) throw new HttpError(400, 'name_required');
    const programme = body.programme ?? current.programme ?? '';
    if (!PROGRAMMES.includes(programme)) throw new HttpError(400, 'invalid_programme');
    return {
      name,
      grade: text(body.grade ?? current.grade, 40),
      programme,
      notes: text(body.notes ?? current.notes, 4000),
    };
  }

  const routes = [
    ['GET', '/api/health', () => ({ ok: true })],

    ['GET', '/api/curriculum', () => curriculum.get()],

    ['GET', '/api/sheets', ({ url }) =>
      sortedSheets({ level: url.searchParams.get('level'), topic: url.searchParams.get('topic') }).then(
        (list) => ({ sheets: list }),
      )],

    ['GET', '/api/sheets/:id/file', async ({ res, params, url }) => {
      const sheet = await getSheet(params.id);
      const filePath = path.join(uploadsDir, sheet.file);
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat) throw new HttpError(404, 'file_missing');
      const name = `${slugify(sheet.title.pt || sheet.title.en) || 'ficha'}.pdf`;
      const disposition = url.searchParams.has('download') ? 'attachment' : 'inline';
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': stat.size,
        'Content-Disposition': `${disposition}; filename="${name}"`,
        'Cache-Control': 'private, max-age=300',
      });
      createReadStream(filePath).pipe(res);
    }],

    ['POST', '/api/admin/login', async ({ req }) => {
      const { password } = await readJson(req);
      const given = crypto.createHash('sha256').update(String(password ?? '')).digest();
      if (!crypto.timingSafeEqual(given, passwordHash)) throw new HttpError(401, 'wrong_password');
      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, Date.now() + SESSION_TTL_MS);
      return { token };
    }],

    ['POST', '/api/admin/logout', ({ req }) => {
      const match = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
      if (match) sessions.delete(match[1]);
      return { ok: true };
    }],

    ['GET', '/api/admin/me', ({ req }) => {
      requireAdmin(req);
      return { ok: true };
    }],

    // --- sheets ---
    ['POST', '/api/admin/sheets', async ({ req }) => {
      requireAdmin(req);
      const form = await readForm(req, MAX_PDF_BYTES + 1024 * 1024);
      const file = form.get('file');
      if (!file || typeof file === 'string' || !file.size) throw new HttpError(400, 'file_required');
      if (file.size > MAX_PDF_BYTES) throw new HttpError(413, 'file_too_large');
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw new HttpError(400, 'not_a_pdf');

      const fields = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string'));
      const meta = await validateSheetFields(fields);
      const id = crypto.randomUUID();
      const sheet = {
        id,
        ...meta,
        file: `${id}.pdf`,
        originalName: text(file.name, 200),
        size: buffer.length,
        createdAt: new Date().toISOString(),
      };
      await fs.writeFile(path.join(uploadsDir, sheet.file), buffer);
      await sheets.update((data) => data.sheets.push(sheet));
      return sheet;
    }],

    ['PATCH', '/api/admin/sheets/:id', async ({ req, params }) => {
      requireAdmin(req);
      const body = await readJson(req);
      const current = await getSheet(params.id);
      const meta = await validateSheetFields(body, current);
      return sheets.update(() => Object.assign(current, meta, { updatedAt: new Date().toISOString() }));
    }],

    ['DELETE', '/api/admin/sheets/:id', async ({ req, params }) => {
      requireAdmin(req);
      const sheet = await getSheet(params.id);
      await sheets.update((data) => {
        data.sheets = data.sheets.filter((s) => s.id !== sheet.id);
      });
      await fs.rm(path.join(uploadsDir, sheet.file), { force: true });
      return { ok: true };
    }],

    // --- curriculum ---
    ['PATCH', '/api/admin/levels/:level', async ({ req, params }) => {
      requireAdmin(req);
      const body = await readJson(req);
      return curriculum.update((data) => {
        const level = findLevel(data, params.level);
        if (typeof body.wip === 'boolean') level.wip = body.wip;
        return level;
      });
    }],

    ['POST', '/api/admin/levels/:level/topics', async ({ req, params }) => {
      requireAdmin(req);
      const body = await readJson(req);
      const name = bilingual(body.namePt, body.nameEn, 80);
      if (!name.pt && !name.en) throw new HttpError(400, 'name_required');
      const id = slugify(body.id || name.pt || name.en);
      if (!id) throw new HttpError(400, 'invalid_id');
      return curriculum.update((data) => {
        const level = findLevel(data, params.level);
        if (level.topics.some((t) => t.id === id)) throw new HttpError(409, 'topic_exists');
        const topic = {
          id,
          name,
          description: bilingual(body.descriptionPt, body.descriptionEn, 300),
          wip: Boolean(body.wip),
        };
        level.topics.push(topic);
        return topic;
      });
    }],

    ['PATCH', '/api/admin/levels/:level/topics/:topic', async ({ req, params }) => {
      requireAdmin(req);
      const body = await readJson(req);
      return curriculum.update((data) => {
        const level = findLevel(data, params.level);
        const topic = findTopic(level, params.topic);
        const name = bilingual(body.namePt ?? topic.name.pt, body.nameEn ?? topic.name.en, 80);
        if (!name.pt && !name.en) throw new HttpError(400, 'name_required');
        const description = bilingual(
          body.descriptionPt ?? topic.description?.pt,
          body.descriptionEn ?? topic.description?.en,
          300,
        );
        const move = Number(body.move || 0);
        topic.name = name;
        topic.description = description;
        if (typeof body.wip === 'boolean') topic.wip = body.wip;
        if (move === -1 || move === 1) {
          const i = level.topics.indexOf(topic);
          const j = i + move;
          if (j >= 0 && j < level.topics.length) [level.topics[i], level.topics[j]] = [level.topics[j], level.topics[i]];
        }
        return topic;
      });
    }],

    ['DELETE', '/api/admin/levels/:level/topics/:topic', async ({ req, params }) => {
      requireAdmin(req);
      const { sheets: all } = await sheets.get();
      if (all.some((s) => s.level === params.level && s.topic === params.topic)) {
        throw new HttpError(409, 'topic_has_sheets');
      }
      return curriculum.update((data) => {
        const level = findLevel(data, params.level);
        findTopic(level, params.topic);
        level.topics = level.topics.filter((t) => t.id !== params.topic);
        return { ok: true };
      });
    }],

    // --- students (teacher's checklist of the teaching sequence) ---
    ['GET', '/api/admin/sequence', ({ req }) => {
      requireAdmin(req);
      return sequence;
    }],

    ['GET', '/api/admin/students', async ({ req }) => {
      requireAdmin(req);
      const { students: all } = await students.get();
      return { students: [...all].sort((a, b) => a.name.localeCompare(b.name)) };
    }],

    ['POST', '/api/admin/students', async ({ req }) => {
      requireAdmin(req);
      const fields = studentFields(await readJson(req));
      const now = new Date().toISOString();
      const student = { id: crypto.randomUUID(), ...fields, progress: {}, createdAt: now, updatedAt: now };
      return students.update((data) => (data.students.push(student), student));
    }],

    ['GET', '/api/admin/students/:id', async ({ req, params }) => {
      requireAdmin(req);
      return findStudent(await students.get(), params.id);
    }],

    ['PATCH', '/api/admin/students/:id', async ({ req, params }) => {
      requireAdmin(req);
      const body = await readJson(req);
      return students.update((data) => {
        const student = findStudent(data, params.id);
        return Object.assign(student, studentFields(body, student), { updatedAt: new Date().toISOString() });
      });
    }],

    // {topics: {"12": "known", "13": null}} sets or clears the status of several topics at once.
    ['PATCH', '/api/admin/students/:id/progress', async ({ req, params }) => {
      requireAdmin(req);
      const { topics } = await readJson(req);
      if (!topics || typeof topics !== 'object') throw new HttpError(400, 'invalid_progress');
      const changes = Object.entries(topics);
      if (changes.some(([id, status]) => !sequenceIds.has(id) || (status !== null && !TOPIC_STATUSES.includes(status)))) {
        throw new HttpError(400, 'invalid_progress');
      }
      return students.update((data) => {
        const student = findStudent(data, params.id);
        const now = new Date().toISOString();
        for (const [id, status] of changes) {
          if (status === null) delete student.progress[id];
          else if (student.progress[id]?.status !== status) student.progress[id] = { status, at: now };
        }
        student.updatedAt = now;
        return student;
      });
    }],

    ['DELETE', '/api/admin/students/:id', async ({ req, params }) => {
      requireAdmin(req);
      return students.update((data) => {
        findStudent(data, params.id);
        data.students = data.students.filter((s) => s.id !== params.id);
        return { ok: true };
      });
    }],
  ].map(([method, pattern, handler]) => {
    const keys = [];
    const regex = new RegExp(
      `^${pattern.replace(/:(\w+)/g, (_, key) => (keys.push(key), '([^/]+)'))}$`,
    );
    return { method, regex, keys, handler };
  });

  return async function handleApi(req, res, url) {
    // Open CORS so a future mobile app (Capacitor/APK) can call this API.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    try {
      for (const route of routes) {
        const match = route.regex.exec(url.pathname);
        if (!match || route.method !== req.method) continue;
        const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
        const result = await route.handler({ req, res, params, url });
        if (!res.headersSent) sendJson(res, 200, result);
        return;
      }
      throw new HttpError(404, 'not_found');
    } catch (err) {
      if (!(err instanceof HttpError)) console.error(err);
      if (res.headersSent) return res.destroy();
      sendJson(res, err.status || 500, { error: err.code || 'server_error' });
    }
  };
}
