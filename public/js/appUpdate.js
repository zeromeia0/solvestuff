import { t } from './i18n.js';
import * as api from './api.js';
import { esc } from './ui.js';

// Only the Android app has a build number (written into config.js by mobile/build.mjs);
// in the browser the site is always current, so there is nothing to check.
const BUILD = Number(window.SOLVESTUFF_APP_BUILD) || 0;
const SNOOZE_KEY = 'solvestuff.updateSnoozed';

function snoozed(versionCode) {
  try {
    return Number(sessionStorage.getItem(SNOOZE_KEY)) === versionCode;
  } catch {
    return false;
  }
}

function snooze(versionCode) {
  try {
    sessionStorage.setItem(SNOOZE_KEY, String(versionCode));
  } catch {}
}

function showPrompt(latest) {
  if (document.getElementById('update-dialog')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'update-dialog';
  dialog.className = 'update-dialog';
  dialog.innerHTML = `
    <h2>${esc(t('update.title'))}</h2>
    <p>${esc(t('update.body', { version: latest.versionName }))}</p>
    ${latest.notes ? `<p class="muted update-notes">${esc(latest.notes)}</p>` : ''}
    <p class="muted small">${esc(t('update.howTo'))}</p>
    <div class="row">
      <a class="btn primary" href="${esc(api.apkUrl())}" data-update="go">${esc(t('update.go'))}</a>
      <button class="btn ghost" type="button" data-update="later">${esc(t('update.later'))}</button>
    </div>`;
  dialog.addEventListener('click', (e) => {
    const action = e.target.closest('[data-update]')?.dataset.update;
    if (!action) return;
    // "Later" hides it until the app is closed and opened again.
    if (action === 'later') snooze(latest.versionCode);
    dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}

async function check() {
  if (document.hidden) return;
  const latest = await api.getAppRelease().catch(() => null);
  if (latest && latest.versionCode > BUILD && !snoozed(latest.versionCode)) showPrompt(latest);
}

// Checks when the app opens and whenever it comes back to the foreground.
export function watchForUpdates() {
  if (!BUILD) return;
  check();
  document.addEventListener('visibilitychange', check);
}
