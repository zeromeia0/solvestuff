import { t, errorMessage } from './i18n.js';
import * as api from './api.js';
import { esc, options, progressBar } from './ui.js';
import { ensureAdmin, adminHead, logout } from './admin.js';

const view = document.getElementById('view');
const STATUSES = ['learning', 'review', 'known'];

let sequenceCache = null;
const getSequence = async () => (sequenceCache ??= await api.admin.sequence());

const blocksOf = (sequence) => sequence.parts.flatMap((p) => p.blocks);

// Topics tagged for one programme (AE2018/AE2023) are hidden for students following the other.
const applies = (item, student) => !item.programme || !student.programme || item.programme === student.programme;
const visibleItems = (items, student) => items.filter((i) => applies(i, student));
const statusOf = (student, id) => student.progress[id]?.status ?? '';

function stats(sequence, student) {
  const items = visibleItems(blocksOf(sequence).flatMap((b) => b.items), student);
  const count = (status) => items.filter((i) => statusOf(student, i.id) === status).length;
  const known = count('known');
  return {
    total: items.length,
    known,
    learning: count('learning'),
    review: count('review'),
    todo: items.length - known - count('learning') - count('review'),
    pct: items.length ? Math.round((known / items.length) * 100) : 0,
    next: items.find((i) => statusOf(student, i.id) !== 'known'),
  };
}

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : '');

const programmeOptions = (selected) =>
  options(
    [
      ['', t('students.programme.all')],
      ['AE2023', 'AE2023'],
      ['AE2018', 'AE2018'],
    ],
    selected,
  );

function setStatus(el, message, kind = '') {
  el.textContent = message;
  el.className = `status ${kind}`;
}

function studentFormFields(student = {}) {
  return `<label class="field"><span>${esc(t('students.name'))}</span>
      <input name="name" maxlength="80" value="${esc(student.name)}" required></label>
    <label class="field"><span>${esc(t('students.grade'))}</span>
      <input name="grade" maxlength="40" value="${esc(student.grade)}" placeholder="${esc(t('students.gradePlaceholder'))}"></label>
    <label class="field span-2"><span>${esc(t('students.programme'))}</span>
      <select name="programme">${programmeOptions(student.programme ?? '')}</select>
      <small class="muted">${esc(t('students.programmeHint'))}</small></label>`;
}

// ---------- list ----------

export async function renderStudents() {
  if (!(await ensureAdmin(renderStudents))) return;
  const [sequence, students] = await Promise.all([getSequence(), api.admin.listStudents()]);
  const blocks = blocksOf(sequence);

  view.innerHTML = `<div id="admin-root">
    ${adminHead('students')}

    <section class="card">
      <h2>${esc(t('students.add'))}</h2>
      <form id="student-form" class="form-grid">
        ${studentFormFields()}
        <div class="field end span-2"><button class="btn primary" type="submit">+ ${esc(t('students.addBtn'))}</button></div>
        <p class="status span-2" role="status"></p>
      </form>
    </section>

    <section class="card">
      <div class="row between">
        <h2>${esc(t('students.title'))} <small class="muted">(${students.length})</small></h2>
        ${students.length > 4 ? `<input type="search" id="student-search" class="search-small" placeholder="${esc(t('students.search'))}">` : ''}
      </div>
      ${
        students.length
          ? `<ul class="student-list">${students.map((s) => studentCard(sequence, s)).join('')}</ul>`
          : `<p class="muted">${esc(t('students.empty'))}</p>`
      }
    </section>

    ${students.length ? overview(blocks, students) : ''}
  </div>`;

  const root = view.querySelector('#admin-root');
  root.querySelector('[data-action="logout"]').addEventListener('click', () => logout(renderStudents));

  const form = root.querySelector('#student-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const student = await api.admin.addStudent(Object.fromEntries(new FormData(form)));
      location.hash = `#/admin/students/${student.id}`;
    } catch (err) {
      if (err.code === 'unauthorized') return renderStudents();
      setStatus(form.querySelector('.status'), errorMessage(err), 'error');
    }
  });

  root.querySelector('#student-search')?.addEventListener('input', (e) => {
    const q = normalize(e.target.value);
    root.querySelectorAll('[data-student-name]').forEach((el) => {
      el.hidden = !normalize(el.dataset.studentName).includes(q);
    });
  });
}

function studentCard(sequence, s) {
  const st = stats(sequence, s);
  return `<li data-student-name="${esc(`${s.name} ${s.grade}`)}">
    <a class="student-card" href="#/admin/students/${esc(s.id)}">
      <div class="row between">
        <strong>${esc(s.name)}</strong>
        <span class="muted small">${esc([s.grade, s.programme].filter(Boolean).join(' · '))}</span>
      </div>
      <div class="step-progress">${progressBar(st.known, st.total)}<small>${st.known}/${st.total} · ${st.pct}%</small></div>
      <div class="small muted">
        ${st.next ? `${esc(t('students.next'))}: <span class="text-body">${esc(st.next.id)}. ${esc(st.next.text)}</span>` : esc(t('students.allKnown'))}
      </div>
      <div class="small muted">${esc(t('students.lastActivity', { date: formatDate(s.updatedAt) }))}</div>
    </a>
  </li>`;
}

// Students × blocks grid: helps spot which blocks a group still needs.
function overview(blocks, students) {
  const head = blocks
    .map((b, i) => `<th scope="col" title="${esc(b.title)}">${i + 1}</th>`)
    .join('');
  const rows = students
    .map((s) => {
      const cells = blocks
        .map((b) => {
          const items = visibleItems(b.items, s);
          const known = items.filter((i) => statusOf(s, i.id) === 'known').length;
          const pct = items.length ? Math.round((known / items.length) * 100) : 0;
          return `<td style="--pct:${pct}%" title="${esc(`${b.title}: ${known}/${items.length}`)}">${pct ? `${pct}` : ''}</td>`;
        })
        .join('');
      return `<tr data-student-name="${esc(`${s.name} ${s.grade}`)}"><th scope="row"><a href="#/admin/students/${esc(s.id)}">${esc(s.name)}</a></th>${cells}</tr>`;
    })
    .join('');
  return `<section class="card">
    <h2>${esc(t('students.overview'))}</h2>
    <p class="muted small">${esc(t('students.overviewHint'))}</p>
    <div class="table-scroll"><table class="overview">
      <thead><tr><th></th>${head}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <ol class="overview-legend small muted">${blocks.map((b) => `<li>${esc(b.title)}</li>`).join('')}</ol>
  </section>`;
}

function normalize(value) {
  return String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// ---------- one student ----------

export async function renderStudent([id]) {
  if (!(await ensureAdmin(() => renderStudent([id])))) return;
  const sequence = await getSequence();
  let student;
  try {
    student = await api.admin.getStudent(id);
  } catch (err) {
    if (err.code !== 'student_not_found') throw err;
    view.innerHTML = `<div id="admin-root">${adminHead('students')}
      <p class="card">${esc(t('students.notFound'))} <a href="#/admin/students">${esc(t('students.back'))}</a></p></div>`;
    view.querySelector('[data-action="logout"]').addEventListener('click', () => logout(() => renderStudent([id])));
    return;
  }

  view.innerHTML = `<div id="admin-root" class="student-page">
    <div class="no-print">${adminHead('students')}</div>
    <a class="back no-print" href="#/admin/students">${esc(t('students.back'))}</a>

    <section class="card">
      <div class="row between">
        <div>
          <h1 data-field="name"></h1>
          <p class="muted" data-field="meta"></p>
        </div>
        <div class="row no-print">
          <button class="btn small ghost" data-action="edit">${esc(t('admin.edit'))}</button>
          <button class="btn small ghost" data-action="print">${esc(t('students.print'))}</button>
          <button class="btn small danger" data-action="delete">${esc(t('admin.delete'))}</button>
        </div>
      </div>
      <form class="form-grid edit-form no-print" id="edit-student" hidden>
        ${studentFormFields(student)}
        <div class="field end row span-2">
          <button class="btn primary small" type="submit">${esc(t('admin.save'))}</button>
          <button class="btn ghost small" type="button" data-action="cancel-edit">${esc(t('admin.cancel'))}</button>
        </div>
        <p class="status span-2" role="status"></p>
      </form>
      <div id="student-stats"></div>
    </section>

    <section class="card">
      <h2>${esc(t('students.notes'))}</h2>
      <form id="notes-form" class="stack">
        <textarea name="notes" rows="4" maxlength="4000" placeholder="${esc(t('students.notesPlaceholder'))}">${esc(student.notes)}</textarea>
        <div class="row no-print">
          <button class="btn small primary" type="submit">${esc(t('admin.save'))}</button>
          <p class="status" role="status"></p>
        </div>
      </form>
    </section>

    <section class="card">
      <div class="checklist-toolbar no-print">
        <div class="segmented small" role="group" aria-label="${esc(t('students.filter'))}">
          ${['all', 'todo', 'learning', 'review', 'known']
            .map(
              (f) => `<label><input type="radio" name="filter" value="${f}"${f === 'all' ? ' checked' : ''}>
                <span>${esc(t(`students.filter.${f}`))}</span></label>`,
            )
            .join('')}
        </div>
        <input type="search" id="topic-search" placeholder="${esc(t('students.searchTopics'))}">
      </div>
      <p class="status" id="checklist-status" role="status"></p>
      <div id="checklist">${sequence.parts.map((part) => partHtml(part, blocksOf(sequence))).join('')}</div>
      <p class="muted" id="checklist-empty" hidden>${esc(t('students.noMatches'))}</p>
    </section>
  </div>`;

  const root = view.querySelector('#admin-root');
  const checklistStatus = root.querySelector('#checklist-status');

  function paint() {
    const st = stats(sequence, student);
    root.querySelector('[data-field="name"]').textContent = student.name;
    root.querySelector('[data-field="meta"]').textContent = [
      student.grade,
      student.programme ? `${t('students.programme')}: ${student.programme}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    const recent = Object.entries(student.progress)
      .filter(([, p]) => p.status === 'known')
      .sort(([, a], [, b]) => b.at.localeCompare(a.at))
      .slice(0, 5)
      .map(([itemId]) => blocksOf(sequence).flatMap((b) => b.items).find((i) => i.id === itemId))
      .filter(Boolean);

    root.querySelector('#student-stats').innerHTML = `
      <div class="student-stats">
        <p class="big-number">${st.pct}% <small>${esc(t('students.knownOf', { known: st.known, total: st.total }))}</small></p>
        ${progressBar(st.known, st.total)}
        <div class="stat-chips">
          ${STATUSES.map((s) => `<span class="pill status-${s}">${esc(t(`students.status.${s}`))}: ${st[s]}</span>`).join('')}
          <span class="pill">${esc(t('students.status.todo'))}: ${st.todo}</span>
        </div>
        ${
          st.next
            ? `<div class="next-topic"><span class="eyebrow">${esc(t('students.next'))}</span>
                <strong>${esc(st.next.id)}. ${esc(st.next.text)}</strong>
                <small class="muted">${esc(t(`students.status.${statusOf(student, st.next.id) || 'todo'}`))}</small></div>`
            : `<p class="notice">${esc(t('students.allKnown'))}</p>`
        }
        ${
          recent.length
            ? `<div><span class="eyebrow">${esc(t('students.recent'))}</span>
                <ul class="recent">${recent.map((i) => `<li>${esc(i.id)}. ${esc(i.text)} <small class="muted">${formatDate(student.progress[i.id].at)}</small></li>`).join('')}</ul></div>`
            : ''
        }
      </div>`;

    root.querySelectorAll('[data-item]').forEach((row) => {
      const itemId = row.dataset.item;
      const status = statusOf(student, itemId);
      const item = blocksOf(sequence).flatMap((b) => b.items).find((i) => i.id === itemId);
      row.dataset.status = status;
      row.classList.toggle('not-applicable', !applies(item, student));
      row.querySelector('input[type=checkbox]').checked = status === 'known';
      row.querySelector('select').value = status;
      row.querySelector('time').textContent = status ? formatDate(student.progress[itemId].at) : '';
    });

    root.querySelectorAll('[data-block]').forEach((el) => {
      const block = blocksOf(sequence)[Number(el.dataset.block)];
      const items = visibleItems(block.items, student);
      const known = items.filter((i) => statusOf(student, i.id) === 'known').length;
      el.querySelector('.block-count').textContent = `${known}/${items.length}`;
      el.querySelector('.block-progress').innerHTML = progressBar(known, items.length);
      el.classList.toggle('complete', items.length > 0 && known === items.length);
      const btn = el.querySelector('[data-action="block-all"]');
      btn.textContent = t(known === items.length ? 'students.clearBlock' : 'students.markBlock');
      btn.dataset.clear = known === items.length ? '1' : '';
    });
    applyFilter();
  }

  function applyFilter() {
    const filter = root.querySelector('input[name=filter]:checked').value;
    const q = normalize(root.querySelector('#topic-search').value.trim());
    let any = false;
    root.querySelectorAll('[data-block]').forEach((block) => {
      let shown = 0;
      block.querySelectorAll('[data-item]').forEach((row) => {
        const status = row.dataset.status || 'todo';
        const match =
          !row.classList.contains('not-applicable') &&
          (filter === 'all' || status === filter) &&
          (!q || normalize(row.dataset.search).includes(q));
        row.hidden = !match;
        if (match) shown++;
      });
      block.hidden = !shown;
      if (shown && (filter !== 'all' || q)) block.open = true;
      any ||= shown > 0;
    });
    root.querySelectorAll('.part').forEach((part) => {
      part.hidden = !part.querySelector('[data-block]:not([hidden])');
    });
    root.querySelector('#checklist-empty').hidden = any;
  }

  async function save(topics) {
    setStatus(checklistStatus, '');
    try {
      student = await api.admin.setProgress(student.id, topics);
    } catch (err) {
      if (err.code === 'unauthorized') return renderStudent([id]);
      setStatus(checklistStatus, errorMessage(err), 'error');
    }
    paint();
  }

  // Blocks open by default only while they still have topics to work on.
  paint();
  root.querySelectorAll('[data-block]').forEach((el) => (el.open = !el.classList.contains('complete')));

  root.addEventListener('change', (e) => {
    const row = e.target.closest('[data-item]');
    if (row && e.target.type === 'checkbox') return save({ [row.dataset.item]: e.target.checked ? 'known' : null });
    if (row && e.target.tagName === 'SELECT') return save({ [row.dataset.item]: e.target.value || null });
    if (e.target.name === 'filter') applyFilter();
  });
  root.querySelector('#topic-search').addEventListener('input', applyFilter);

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const editForm = root.querySelector('#edit-student');
    switch (btn.dataset.action) {
      case 'logout':
        return logout(() => renderStudent([id]));
      case 'edit':
        editForm.hidden = !editForm.hidden;
        return;
      case 'cancel-edit':
        editForm.hidden = true;
        return;
      case 'print':
        root.querySelector('input[name=filter][value=all]').checked = true;
        root.querySelector('#topic-search').value = '';
        applyFilter();
        root.querySelectorAll('[data-block]').forEach((el) => (el.open = true));
        return window.print();
      case 'delete':
        if (!btn.dataset.armed) {
          btn.dataset.armed = '1';
          btn.textContent = t('students.confirmDelete');
          return;
        }
        return api.admin.deleteStudent(student.id).then(
          () => (location.hash = '#/admin/students'),
          (err) => setStatus(checklistStatus, errorMessage(err), 'error'),
        );
      case 'block-all': {
        e.preventDefault();
        const block = blocksOf(sequence)[Number(btn.closest('[data-block]').dataset.block)];
        const status = btn.dataset.clear ? null : 'known';
        return save(Object.fromEntries(visibleItems(block.items, student).map((i) => [i.id, status])));
      }
    }
  });

  root.querySelector('#edit-student').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      student = await api.admin.updateStudent(student.id, Object.fromEntries(new FormData(form)));
      form.hidden = true;
      paint();
    } catch (err) {
      if (err.code === 'unauthorized') return renderStudent([id]);
      setStatus(form.querySelector('.status'), errorMessage(err), 'error');
    }
  });

  root.querySelector('#notes-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const status = form.querySelector('.status');
    try {
      student = await api.admin.updateStudent(student.id, { notes: form.notes.value });
      setStatus(status, t('students.saved'), 'ok');
    } catch (err) {
      if (err.code === 'unauthorized') return renderStudent([id]);
      setStatus(status, errorMessage(err), 'error');
    }
  });
}

function partHtml(part, allBlocks) {
  return `<div class="part">
    <h2 class="part-title">${esc(part.title)}</h2>
    ${part.blocks.map((block) => blockHtml(block, allBlocks.indexOf(block))).join('')}
  </div>`;
}

function blockHtml(block, index) {
  return `<details class="seq-block" data-block="${index}">
    <summary>
      <span class="block-title"><span class="muted">${index + 1}.</span> ${esc(block.title)}</span>
      <span class="block-progress"></span>
      <span class="block-count muted small"></span>
    </summary>
    <div class="row block-actions no-print"><button class="btn small ghost" type="button" data-action="block-all"></button></div>
    <ol class="checklist">${block.items.map(itemHtml).join('')}</ol>
  </details>`;
}

function itemHtml(item) {
  return `<li class="check-item" data-item="${esc(item.id)}" data-search="${esc(`${item.id} ${item.text} ${item.refs}`)}">
    <label class="check" title="${esc(t('students.status.known'))}">
      <input type="checkbox" aria-label="${esc(`${item.id}. ${item.text}`)}">
      <span aria-hidden="true">✓</span>
    </label>
    <div class="check-text">
      <span><span class="muted">${esc(item.id)}.</span> ${esc(item.text)}</span>
      <span class="small muted">${item.refs ? esc(item.refs) : ''}${item.programme ? ` <span class="badge wip">${esc(item.programme)}</span>` : ''} <time></time></span>
    </div>
    <select class="status-select" aria-label="${esc(t('students.statusLabel'))}">
      ${options([['', t('students.status.todo')], ...STATUSES.map((s) => [s, t(`students.status.${s}`)])], '')}
    </select>
  </li>`;
}
