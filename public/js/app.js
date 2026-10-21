import { t, L, getLang, setLang } from './i18n.js';
import * as api from './api.js';
import * as user from './user.js';
import { esc, levelById, wipBadge, progressBar, sheetList, levelPicker, options, topicName } from './ui.js';
import { renderAdmin } from './admin.js';
import { renderStudents, renderStudent } from './students.js';

const view = document.getElementById('view');
const nav = document.getElementById('nav');

// ---------- views ----------

async function renderLogin() {
  const curriculum = await api.getCurriculum();
  view.innerHTML = `
    <section class="card narrow hero">
      <h1>${esc(t('login.title'))}</h1>
      <p class="muted">${esc(t('login.subtitle'))}</p>
      <form id="login-form" class="stack">
        <label class="field">
          <span>${esc(t('login.name'))}</span>
          <input name="name" autocomplete="given-name" maxlength="40" placeholder="${esc(t('login.namePlaceholder'))}" required>
        </label>
        <fieldset class="field">
          <legend>${esc(t('login.level'))}</legend>
          ${levelPicker(curriculum, 'level', curriculum.levels[0]?.id)}
        </fieldset>
        <button class="btn primary big" type="submit">${esc(t('login.submit'))}</button>
      </form>
    </section>`;
  view.querySelector('#login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const name = String(data.get('name')).trim();
    if (!name) return;
    user.saveUser({ name, level: data.get('level') });
    location.hash = '#/';
  });
}

function pathwayStats(level, sheets) {
  return level.topics.map((topic) => {
    const list = sheets.filter((s) => s.topic === topic.id);
    return { topic, total: list.length, done: list.filter((s) => user.isDone(s.id)).length };
  });
}

async function renderHome() {
  const u = user.getUser();
  const [curriculum, sheets] = await Promise.all([api.getCurriculum(), api.listSheets({ level: u.level })]);
  const level = levelById(curriculum, u.level);
  const stats = pathwayStats(level, sheets);
  const total = sheets.length;
  const doneCount = sheets.filter((s) => user.isDone(s.id)).length;
  const next = stats.find((s) => s.done < s.total);
  // sheets come back in pathway order, so the first pending ones are what to do next
  const upNext = sheets.filter((s) => !user.isDone(s.id)).slice(0, 5);

  let continueBlock;
  if (!total) continueBlock = `<p class="muted">${esc(t('home.continueEmpty'))}</p>`;
  else if (!next) continueBlock = `<p>${esc(t('home.allDone'))} 🎉</p>`;
  else
    continueBlock = `<a class="topic-link" href="#/topic/${esc(level.id)}/${esc(next.topic.id)}">
        <strong>${esc(L(next.topic.name))}</strong>
        <span class="muted">${esc(t('sheet.count', { done: next.done, total: next.total }))}</span>
        <span class="arrow">→</span>
      </a>`;

  view.innerHTML = `
    <section class="greeting">
      <h1>${esc(t('home.hello', { name: u.name }))}</h1>
      <p class="muted">${esc(t('home.levelIs', { level: L(level.name) }))} ${level.wip ? wipBadge() : ''}</p>
    </section>
    <div class="grid two">
      <section class="card">
        <h2>${esc(t('home.progress'))}</h2>
        <p class="big-number">${doneCount}<small>/${total}</small></p>
        ${progressBar(doneCount, total)}
        <a class="btn ghost" href="#/pathway">${esc(t('home.seePathway'))}</a>
      </section>
      <section class="card">
        <h2>${esc(t('home.continue'))}</h2>
        ${continueBlock}
      </section>
    </div>
    ${upNext.length ? `<section class="card"><h2>${esc(t('home.upNext'))}</h2>${sheetList(upNext, curriculum)}</section>` : ''}`;
}

async function renderPathway(_, query) {
  const u = user.getUser();
  const curriculum = await api.getCurriculum();
  const levelId = levelById(curriculum, query.get('level')) ? query.get('level') : u.level;
  const level = levelById(curriculum, levelId);
  const sheets = await api.listSheets({ level: level.id });
  const stats = pathwayStats(level, sheets);
  const base = level.buildsOn && levelById(curriculum, level.buildsOn);

  view.innerHTML = `
    <section class="page-head">
      <h1>${esc(t('pathway.title'))}</h1>
      <p class="muted">${esc(t('pathway.intro'))}</p>
      <div class="tabs">${curriculum.levels
        .map(
          (l) => `<a href="#/pathway?level=${esc(l.id)}" class="tab${l.id === level.id ? ' active' : ''}">
            ${esc(L(l.name))}${l.id === u.level ? ` <small>(${esc(t('pathway.yourLevel'))})</small>` : ''}</a>`,
        )
        .join('')}</div>
    </section>
    ${level.wip ? `<p class="notice">${wipBadge()} ${esc(L(level.description))}</p>` : ''}
    ${base ? `<p class="notice">${esc(t('pathway.buildsOn', { level: L(base.name) }))} <a href="#/pathway?level=${esc(base.id)}">${esc(t('pathway.review'))} →</a></p>` : ''}
    ${
      stats.length
        ? `<ol class="steps">${stats
            .map(
              ({ topic, total, done }, i) => `<li class="step${total && done === total ? ' complete' : ''}">
                <span class="step-num">${total && done === total ? '✓' : i + 1}</span>
                <a class="step-body" href="#/topic/${esc(level.id)}/${esc(topic.id)}">
                  <strong>${esc(L(topic.name))} ${topic.wip ? wipBadge() : ''}</strong>
                  ${L(topic.description) ? `<span class="muted">${esc(L(topic.description))}</span>` : ''}
                  <span class="step-progress">${progressBar(done, total)}<small>${esc(t('sheet.count', { done, total }))}</small></span>
                </a>
              </li>`,
            )
            .join('')}</ol>`
        : `<p class="card muted">${esc(t('pathway.empty'))}</p>`
    }`;
}

async function renderTopic([levelId, topicId]) {
  const curriculum = await api.getCurriculum();
  const level = levelById(curriculum, levelId);
  const topic = level?.topics.find((tp) => tp.id === topicId);
  if (!topic) return renderNotFound();
  const sheets = await api.listSheets({ level: levelId, topic: topicId });
  view.innerHTML = `
    <a class="back" href="#/pathway?level=${esc(levelId)}">${esc(t('topic.back'))}</a>
    <section class="page-head">
      <p class="eyebrow">${esc(L(level.name))}</p>
      <h1>${esc(L(topic.name))} ${topic.wip ? wipBadge() : ''}</h1>
      ${L(topic.description) ? `<p class="muted">${esc(L(topic.description))}</p>` : ''}
    </section>
    ${sheets.length ? sheetList(sheets, curriculum, { showTopic: false }) : `<p class="card muted">${esc(t('topic.empty'))}</p>`}`;
}

async function renderSheets(_, query) {
  const u = user.getUser();
  const curriculum = await api.getCurriculum();
  const all = await api.listSheets();
  const state = {
    level: query.has('level') ? query.get('level') : u.level,
    topic: query.get('topic') || '',
    q: query.get('q') || '',
    hideDone: query.get('hideDone') === '1',
  };

  view.innerHTML = `
    <section class="page-head"><h1>${esc(t('sheets.title'))}</h1></section>
    <form class="filters" id="filters">
      <input type="search" name="q" placeholder="${esc(t('sheets.search'))}" value="${esc(state.q)}">
      <select name="level"></select>
      <select name="topic"></select>
      <label class="toggle"><input type="checkbox" name="hideDone"${state.hideDone ? ' checked' : ''}> ${esc(t('sheets.hideDone'))}</label>
    </form>
    <p class="muted count" id="count"></p>
    <div id="results"></div>`;

  const form = view.querySelector('#filters');
  const fillSelects = () => {
    form.level.innerHTML = options(
      [['', t('sheets.allLevels')], ...curriculum.levels.map((l) => [l.id, L(l.name)])],
      state.level,
    );
    const topics = state.level ? levelById(curriculum, state.level)?.topics ?? [] : [];
    form.topic.innerHTML = options([['', t('sheets.allTopics')], ...topics.map((tp) => [tp.id, L(tp.name)])], state.topic);
    form.topic.disabled = !state.level;
  };

  const apply = () => {
    const q = state.q.toLowerCase();
    const list = all.filter(
      (s) =>
        (!state.level || s.level === state.level) &&
        (!state.topic || s.topic === state.topic) &&
        (!state.hideDone || !user.isDone(s.id)) &&
        (!q ||
          [s.title.pt, s.title.en, s.description.pt, s.description.en, topicName(curriculum, s.level, s.topic)]
            .join(' ')
            .toLowerCase()
            .includes(q)),
    );
    view.querySelector('#count').textContent = t('sheets.count', { n: list.length });
    view.querySelector('#results').innerHTML = list.length
      ? sheetList(list, curriculum)
      : `<p class="card muted">${esc(t('sheets.none'))}</p>`;
  };

  form.addEventListener('input', (e) => {
    if (e.target.name === 'level') state.topic = '';
    state.level = form.level.value;
    state.topic = e.target.name === 'level' ? '' : form.topic.value;
    state.q = form.q.value;
    state.hideDone = form.hideDone.checked;
    if (e.target.name === 'level') fillSelects();
    apply();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  fillSelects();
  apply();
}

async function renderProfile() {
  const u = user.getUser();
  const curriculum = await api.getCurriculum();
  view.innerHTML = `
    <section class="page-head"><h1>${esc(t('profile.title'))}</h1></section>
    <section class="card narrow">
      <form id="profile-form" class="stack">
        <label class="field">
          <span>${esc(t('profile.name'))}</span>
          <input name="name" maxlength="40" value="${esc(u.name)}" required>
        </label>
        <fieldset class="field">
          <legend>${esc(t('profile.level'))}</legend>
          ${levelPicker(curriculum, 'level', u.level)}
        </fieldset>
        <fieldset class="field">
          <legend>${esc(t('profile.language'))}</legend>
          <div class="segmented">
            <label><input type="radio" name="lang" value="pt"${getLang() === 'pt' ? ' checked' : ''}><span>Português</span></label>
            <label><input type="radio" name="lang" value="en"${getLang() === 'en' ? ' checked' : ''}><span>English</span></label>
          </div>
        </fieldset>
        <button class="btn primary" type="submit">${esc(t('profile.save'))}</button>
        <p class="status" id="profile-status" role="status"></p>
      </form>
      <p class="muted small">${esc(t('profile.note'))}</p>
      <div class="row">
        <button class="btn ghost" id="reset">${esc(t('profile.resetProgress'))}</button>
        <button class="btn danger" id="logout">${esc(t('profile.logout'))}</button>
      </div>
    </section>`;

  view.querySelector('#profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const name = String(data.get('name')).trim();
    if (!name) return;
    user.saveUser({ name, level: data.get('level') });
    const langChanged = data.get('lang') !== getLang();
    setLang(data.get('lang'));
    if (langChanged) {
      route();
      return;
    }
    view.querySelector('#profile-status').textContent = t('profile.saved');
  });
  const reset = view.querySelector('#reset');
  reset.addEventListener('click', () => {
    if (reset.dataset.armed) {
      user.resetProgress();
      reset.textContent = t('profile.resetProgress');
      delete reset.dataset.armed;
    } else {
      reset.dataset.armed = '1';
      reset.textContent = t('profile.resetConfirm');
    }
  });
  view.querySelector('#logout').addEventListener('click', () => {
    user.logout();
    location.hash = '#/login';
  });
}

function renderNotFound() {
  view.innerHTML = `<section class="card narrow"><h1>404</h1><a href="#/">${esc(t('nav.home'))}</a></section>`;
}

// ---------- router ----------

const routes = [
  [/^\/login$/, renderLogin, { public: true }],
  [/^\/$/, renderHome, { nav: 'home' }],
  [/^\/pathway$/, renderPathway, { nav: 'pathway' }],
  [/^\/topic\/([\w-]+)\/([\w-]+)$/, renderTopic, { nav: 'pathway' }],
  [/^\/sheets$/, renderSheets, { nav: 'sheets' }],
  [/^\/profile$/, renderProfile, { nav: 'profile' }],
  [/^\/admin$/, renderAdmin, { public: true }],
  [/^\/admin\/students$/, renderStudents, { public: true }],
  [/^\/admin\/students\/([\w-]+)$/, renderStudent, { public: true }],
];

function renderChrome(active) {
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('active', b.dataset.lang === getLang()));
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === active));
  nav.hidden = !user.getUser();
}

let renderId = 0;

async function route() {
  const [path, qs = ''] = (location.hash.slice(1) || '/').split('?');
  const query = new URLSearchParams(qs);
  const entry = routes.find(([re]) => re.test(path));
  if (!entry) {
    renderChrome();
    return renderNotFound();
  }
  const [re, render, opts = {}] = entry;
  if (!opts.public && !user.getUser()) {
    location.hash = '#/login';
    return;
  }
  // A saved level might have been removed from the curriculum.
  if (user.getUser()) {
    const curriculum = await api.getCurriculum().catch(() => null);
    if (curriculum && !levelById(curriculum, user.getUser().level)) {
      user.saveUser({ ...user.getUser(), level: curriculum.levels[0].id });
    }
  }
  if (path === '/login' && user.getUser()) {
    location.hash = '#/';
    return;
  }
  renderChrome(opts.nav);
  const id = ++renderId;
  view.setAttribute('aria-busy', 'true');
  try {
    await render(re.exec(path).slice(1), query);
  } catch (err) {
    console.error(err);
    if (id === renderId) view.innerHTML = `<p class="card error">${esc(t('error'))}</p>`;
  } finally {
    view.removeAttribute('aria-busy');
  }
  if (id === renderId) window.scrollTo(0, 0);
}

// Mark-as-done checkboxes anywhere in the student views.
view.addEventListener('change', (e) => {
  const id = e.target.dataset?.done;
  if (!id) return;
  user.setDone(id, e.target.checked);
  e.target.closest('.sheet')?.classList.toggle('is-done', e.target.checked);
});

document.querySelectorAll('[data-lang]').forEach((btn) =>
  btn.addEventListener('click', () => {
    setLang(btn.dataset.lang);
    route();
  }),
);

export { route };

setLang(getLang());
window.addEventListener('hashchange', route);
route();
