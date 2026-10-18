import { t, L, errorMessage } from './i18n.js';
import * as api from './api.js';
import { esc, levelById, wipBadge, difficultyBadge, options, topicName } from './ui.js';

const view = document.getElementById('view');

const difficultyOptions = (selected) =>
  options([1, 2, 3].map((d) => [String(d), t(`difficulty.${d}`)]), String(selected));

const topicOptions = (curriculum, levelId, selected) =>
  options((levelById(curriculum, levelId)?.topics ?? []).map((tp) => [tp.id, L(tp.name)]), selected);

const levelOptions = (curriculum, selected) =>
  options(curriculum.levels.map((l) => [l.id, L(l.name)]), selected);

function setStatus(el, message, kind = '') {
  el.textContent = message;
  el.className = `status ${kind}`;
}

export async function renderAdmin() {
  if (!api.getAdminToken() || !(await api.admin.me().then(() => true, () => false))) {
    api.setAdminToken(null);
    return renderAdminLogin();
  }
  const [curriculum, sheets] = await Promise.all([api.getCurriculum({ fresh: true }), api.listSheets()]);
  const firstLevel = curriculum.levels.find((l) => l.topics.length) ?? curriculum.levels[0];

  view.innerHTML = `<div id="admin-root">
    <section class="page-head row between">
      <h1>${esc(t('admin.title'))}</h1>
      <button class="btn ghost" data-action="logout">${esc(t('admin.logout'))}</button>
    </section>

    <section class="card">
      <h2>${esc(t('admin.upload'))}</h2>
      <form id="upload-form" class="form-grid">
        <label class="field span-2"><span>${esc(t('admin.file'))}</span>
          <input type="file" name="file" accept="application/pdf,.pdf" required></label>
        <label class="field"><span>${esc(t('admin.titlePt'))}</span><input name="titlePt" maxlength="160" required></label>
        <label class="field"><span>${esc(t('admin.titleEn'))}</span><input name="titleEn" maxlength="160"></label>
        <label class="field"><span>${esc(t('admin.descPt'))}</span><textarea name="descriptionPt" rows="2" maxlength="600"></textarea></label>
        <label class="field"><span>${esc(t('admin.descEn'))}</span><textarea name="descriptionEn" rows="2" maxlength="600"></textarea></label>
        <label class="field"><span>${esc(t('admin.level'))}</span>
          <select name="level" data-level-select>${levelOptions(curriculum, firstLevel.id)}</select></label>
        <label class="field"><span>${esc(t('admin.topic'))}</span>
          <select name="topic" required>${topicOptions(curriculum, firstLevel.id)}</select></label>
        <label class="field"><span>${esc(t('admin.difficulty'))}</span>
          <select name="difficulty">${difficultyOptions(1)}</select></label>
        <div class="field end"><button class="btn primary" type="submit">${esc(t('admin.uploadBtn'))}</button></div>
        <p class="status span-2" id="upload-status" role="status"></p>
      </form>
    </section>

    <section class="card">
      <h2>${esc(t('admin.sheets'))} <small class="muted">(${sheets.length})</small></h2>
      ${
        sheets.length
          ? `<ul class="admin-list">${sheets.map((s) => sheetRow(curriculum, s)).join('')}</ul>`
          : `<p class="muted">${esc(t('admin.noSheets'))}</p>`
      }
    </section>

    <section class="card">
      <h2>${esc(t('admin.curriculum'))}</h2>
      ${curriculum.levels.map((level) => levelBlock(level, sheets)).join('')}
    </section></div>`;

  // Bind to a fresh root each render so listeners never pile up.
  bind(view.querySelector('#admin-root'), curriculum);
}

function sheetRow(curriculum, s) {
  return `<li class="admin-item" data-sheet="${esc(s.id)}">
    <div class="admin-item-main">
      <a href="${api.fileUrl(s.id)}" target="_blank" rel="noopener"><strong>${esc(L(s.title))}</strong></a>
      <div class="sheet-meta">
        <span>${esc(L(levelById(curriculum, s.level)?.name) || s.level)} › ${esc(topicName(curriculum, s.level, s.topic))}</span>
        ${difficultyBadge(s.difficulty)}
        <span class="muted">${(s.size / 1024 / 1024).toFixed(1)} MB · ${new Date(s.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
    <div class="row">
      <button class="btn small ghost" data-action="edit-sheet">${esc(t('admin.edit'))}</button>
      <button class="btn small danger" data-action="delete-sheet">${esc(t('admin.delete'))}</button>
    </div>
    <form class="form-grid edit-form" hidden>
      <label class="field"><span>${esc(t('admin.titlePt'))}</span><input name="titlePt" maxlength="160" value="${esc(s.title.pt)}"></label>
      <label class="field"><span>${esc(t('admin.titleEn'))}</span><input name="titleEn" maxlength="160" value="${esc(s.title.en)}"></label>
      <label class="field"><span>${esc(t('admin.descPt'))}</span><textarea name="descriptionPt" rows="2" maxlength="600">${esc(s.description.pt)}</textarea></label>
      <label class="field"><span>${esc(t('admin.descEn'))}</span><textarea name="descriptionEn" rows="2" maxlength="600">${esc(s.description.en)}</textarea></label>
      <label class="field"><span>${esc(t('admin.level'))}</span><select name="level" data-level-select>${levelOptions(curriculum, s.level)}</select></label>
      <label class="field"><span>${esc(t('admin.topic'))}</span><select name="topic">${topicOptions(curriculum, s.level, s.topic)}</select></label>
      <label class="field"><span>${esc(t('admin.difficulty'))}</span><select name="difficulty">${difficultyOptions(s.difficulty)}</select></label>
      <div class="field end row">
        <button class="btn primary small" type="submit">${esc(t('admin.save'))}</button>
        <button class="btn ghost small" type="button" data-action="cancel-edit">${esc(t('admin.cancel'))}</button>
      </div>
      <p class="status span-2" role="status"></p>
    </form>
  </li>`;
}

function levelBlock(level, sheets) {
  return `<div class="level-block" data-level="${esc(level.id)}">
    <div class="row between">
      <h3>${esc(L(level.name))} <small class="muted">${esc(L(level.description))}</small></h3>
      <label class="toggle"><input type="checkbox" data-action="level-wip"${level.wip ? ' checked' : ''}> ${esc(t('admin.levelWip'))}</label>
    </div>
    ${
      level.topics.length
        ? `<ol class="admin-topics">${level.topics
            .map((tp, i) => {
              const count = sheets.filter((s) => s.level === level.id && s.topic === tp.id).length;
              return `<li data-topic="${esc(tp.id)}">
                <form class="topic-row" data-action="save-topic">
                  <input name="namePt" value="${esc(tp.name.pt)}" aria-label="${esc(t('admin.namePt'))}" maxlength="80">
                  <input name="nameEn" value="${esc(tp.name.en)}" aria-label="${esc(t('admin.nameEn'))}" maxlength="80">
                  <span class="muted small">${count} 📄</span>
                  <label class="toggle small"><input type="checkbox" name="wip"${tp.wip ? ' checked' : ''}> ${esc(t('admin.topicWip'))}</label>
                  <span class="row tight">
                    <button class="btn icon" type="button" data-action="move-topic" data-dir="-1" title="${esc(t('admin.moveUp'))}"${i === 0 ? ' disabled' : ''}>↑</button>
                    <button class="btn icon" type="button" data-action="move-topic" data-dir="1" title="${esc(t('admin.moveDown'))}"${i === level.topics.length - 1 ? ' disabled' : ''}>↓</button>
                    <button class="btn small primary" type="submit">${esc(t('admin.save'))}</button>
                    <button class="btn small danger" type="button" data-action="delete-topic">${esc(t('admin.delete'))}</button>
                  </span>
                </form>
              </li>`;
            })
            .join('')}</ol>`
        : `<p class="muted">${esc(t('admin.noTopics'))}</p>`
    }
    <form class="topic-row add" data-action="add-topic">
      <input name="namePt" placeholder="${esc(t('admin.namePt'))}" maxlength="80" required>
      <input name="nameEn" placeholder="${esc(t('admin.nameEn'))}" maxlength="80">
      <button class="btn small" type="submit">+ ${esc(t('admin.addTopic'))}</button>
    </form>
    <p class="status" role="status"></p>
  </div>`;
}

function bind(root, curriculum) {
  const fail = (statusEl) => (err) => {
    if (err.code === 'unauthorized') return renderAdmin();
    setStatus(statusEl, errorMessage(err), 'error');
  };

  // Level select drives its sibling topic select.
  root.addEventListener('change', (e) => {
    if (e.target.matches('[data-level-select]')) {
      e.target.form.topic.innerHTML = topicOptions(curriculum, e.target.value);
    }
    if (e.target.dataset.action === 'level-wip') {
      const block = e.target.closest('[data-level]');
      api.admin
        .updateLevel(block.dataset.level, { wip: e.target.checked })
        .then(() => api.getCurriculum({ fresh: true }), fail(block.querySelector(':scope > .status')));
    }
  });

  const upload = root.querySelector('#upload-form');
  upload.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = upload.querySelector('#upload-status');
    const button = upload.querySelector('[type=submit]');
    button.disabled = true;
    setStatus(status, t('admin.uploading'));
    try {
      await api.admin.uploadSheet(new FormData(upload));
      await renderAdmin();
      setStatus(view.querySelector('#upload-status'), t('admin.uploaded'), 'ok');
    } catch (err) {
      fail(status)(err);
      button.disabled = false;
    }
  });

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.tagName === 'FORM' || btn.type === 'checkbox') return;
    const item = btn.closest('[data-sheet]');
    const topicLi = btn.closest('[data-topic]');
    const levelEl = btn.closest('[data-level]');

    switch (btn.dataset.action) {
      case 'logout':
        await api.admin.logout().catch(() => {});
        api.setAdminToken(null);
        return renderAdmin();
      case 'edit-sheet':
        item.querySelector('.edit-form').hidden = false;
        return;
      case 'cancel-edit':
        item.querySelector('.edit-form').hidden = true;
        return;
      case 'delete-sheet':
        if (!btn.dataset.armed) {
          btn.dataset.armed = '1';
          btn.textContent = t('admin.confirmDelete');
          return;
        }
        return api.admin.deleteSheet(item.dataset.sheet).then(renderAdmin, (err) => err.code === 'unauthorized' && renderAdmin());
      case 'move-topic':
        return api.admin
          .updateTopic(levelEl.dataset.level, topicLi.dataset.topic, { move: Number(btn.dataset.dir) })
          .then(renderAdmin, fail(levelEl.querySelector(':scope > .status')));
      case 'delete-topic':
        if (!btn.dataset.armed) {
          btn.dataset.armed = '1';
          btn.textContent = t('admin.confirmDelete');
          return;
        }
        return api.admin
          .deleteTopic(levelEl.dataset.level, topicLi.dataset.topic)
          .then(renderAdmin, fail(levelEl.querySelector(':scope > .status')));
    }
  });

  root.addEventListener('submit', (e) => {
    const form = e.target;
    if (form.id === 'upload-form') return;
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const item = form.closest('[data-sheet]');
    const levelEl = form.closest('[data-level]');
    if (item) {
      return api.admin.updateSheet(item.dataset.sheet, data).then(renderAdmin, fail(form.querySelector('.status')));
    }
    const status = levelEl.querySelector(':scope > .status');
    if (form.dataset.action === 'add-topic') {
      return api.admin.addTopic(levelEl.dataset.level, data).then(renderAdmin, fail(status));
    }
    if (form.dataset.action === 'save-topic') {
      const topicId = form.closest('[data-topic]').dataset.topic;
      return api.admin
        .updateTopic(levelEl.dataset.level, topicId, { ...data, wip: form.wip.checked })
        .then(renderAdmin, fail(status));
    }
  });
}

function renderAdminLogin() {
  view.innerHTML = `
    <section class="card narrow">
      <h1>${esc(t('admin.title'))}</h1>
      <form id="admin-login" class="stack">
        <label class="field"><span>${esc(t('admin.password'))}</span>
          <input type="password" name="password" autocomplete="current-password" required></label>
        <button class="btn primary" type="submit">${esc(t('admin.login'))}</button>
        <p class="status" role="status"></p>
      </form>
    </section>`;
  const form = view.querySelector('#admin-login');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const { token } = await api.admin.login(form.password.value);
      api.setAdminToken(token);
      renderAdmin();
    } catch {
      setStatus(form.querySelector('.status'), t('admin.wrongPassword'), 'error');
    }
  });
}
