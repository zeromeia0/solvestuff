import { t, L } from './i18n.js';
import { fileUrl } from './api.js';
import { isDone } from './user.js';

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export const levelById = (curriculum, id) => curriculum.levels.find((l) => l.id === id);

export function topicName(curriculum, levelId, topicId) {
  const topic = levelById(curriculum, levelId)?.topics.find((tp) => tp.id === topicId);
  return topic ? L(topic.name) : topicId;
}

export const wipBadge = () => `<span class="badge wip">${esc(t('wip'))}</span>`;

export function progressBar(doneCount, total) {
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  return `<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>`;
}

export function sheetList(sheets, curriculum, { showTopic = true } = {}) {
  return `<ul class="sheet-list">${sheets
    .map((s) => {
      const done = isDone(s.id);
      const desc = L(s.description);
      return `<li class="sheet${done ? ' is-done' : ''}">
        <label class="check" title="${esc(t('sheet.markDone'))}">
          <input type="checkbox" data-done="${esc(s.id)}"${done ? ' checked' : ''}>
          <span aria-hidden="true">✓</span>
        </label>
        <div class="sheet-main">
          <a class="sheet-title" href="${fileUrl(s.id)}" target="_blank" rel="noopener">${esc(L(s.title))}</a>
          <div class="sheet-meta">
            ${showTopic ? `<span>${esc(topicName(curriculum, s.level, s.topic))}</span>` : ''}
          </div>
          ${desc ? `<p class="sheet-desc">${esc(desc)}</p>` : ''}
        </div>
        <div class="sheet-actions">
          <a class="btn small" href="${fileUrl(s.id)}" target="_blank" rel="noopener">${esc(t('sheet.open'))}</a>
          <a class="btn small ghost" href="${fileUrl(s.id, true)}">${esc(t('sheet.download'))}</a>
        </div>
      </li>`;
    })
    .join('')}</ul>`;
}

export function levelPicker(curriculum, name, selected) {
  return `<div class="level-picker">${curriculum.levels
    .map(
      (l) => `<label class="level-option">
        <input type="radio" name="${name}" value="${esc(l.id)}"${l.id === selected ? ' checked' : ''} required>
        <span class="level-card">
          <strong>${esc(L(l.name))}</strong>
          <small>${esc(L(l.description))}</small>
          ${l.wip ? wipBadge() : ''}
        </span>
      </label>`,
    )
    .join('')}</div>`;
}

export function options(items, selected) {
  return items
    .map(([value, label]) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`)
    .join('');
}
