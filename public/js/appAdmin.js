import { t, errorMessage } from './i18n.js';
import * as api from './api.js';
import { esc } from './ui.js';
import { ensureAdmin, adminHead, logout } from './admin.js';

const view = document.getElementById('view');

// mobile/build.mjs names its output solvestuff-<versionName>-build<versionCode>.apk.
const BUILT_NAME = /^solvestuff-(.+)-build(\d+)\.apk$/;

function setStatus(el, message, kind = '') {
  el.textContent = message;
  el.className = `status ${kind}`;
}

export async function renderAppAdmin() {
  if (!(await ensureAdmin(renderAppAdmin))) return;
  const latest = await api.getAppRelease();
  const downloadUrl = new URL(api.apkUrl(), location.href).href;

  view.innerHTML = `<div id="admin-root">
    ${adminHead('app')}

    <section class="card">
      <h2>${esc(t('appAdmin.current'))}</h2>
      ${
        latest
          ? `<p><strong>${esc(latest.versionName)}</strong> <span class="muted">(build ${latest.versionCode})</span></p>
            <p class="muted small">${esc(new Date(latest.publishedAt).toLocaleString())} · ${(latest.size / 1024 / 1024).toFixed(1)} MB</p>
            ${latest.notes ? `<p>${esc(latest.notes)}</p>` : ''}
            <p class="muted small">${esc(t('appAdmin.installLink'))}</p>
            <p><a href="${esc(downloadUrl)}">${esc(downloadUrl)}</a></p>`
          : `<p class="muted">${esc(t('appAdmin.none'))}</p>`
      }
    </section>

    <section class="card">
      <h2>${esc(t('appAdmin.publish'))}</h2>
      <p class="muted small">${esc(t('appAdmin.publishHelp'))}</p>
      <form id="app-form" class="form-grid">
        <label class="field span-2"><span>${esc(t('appAdmin.file'))}</span>
          <input type="file" name="file" accept=".apk,application/vnd.android.package-archive" required></label>
        <label class="field"><span>${esc(t('appAdmin.versionCode'))}</span>
          <input type="number" name="versionCode" min="${(latest?.versionCode ?? 0) + 1}" step="1" value="${(latest?.versionCode ?? 0) + 1}" required></label>
        <label class="field"><span>${esc(t('appAdmin.versionName'))}</span><input name="versionName" maxlength="40"></label>
        <label class="field span-2"><span>${esc(t('appAdmin.notes'))}</span><textarea name="notes" rows="2" maxlength="600"></textarea></label>
        <div class="field end span-2"><button class="btn primary" type="submit">${esc(t('appAdmin.publishBtn'))}</button></div>
        <p class="status span-2" role="status"></p>
      </form>
    </section>
  </div>`;

  const root = view.querySelector('#admin-root');
  root.querySelector('[data-action="logout"]').addEventListener('click', () => logout(renderAppAdmin));

  const form = root.querySelector('#app-form');
  form.file.addEventListener('change', () => {
    const match = BUILT_NAME.exec(form.file.files[0]?.name ?? '');
    if (!match) return;
    form.versionName.value = match[1];
    form.versionCode.value = match[2];
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = form.querySelector('.status');
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    setStatus(status, t('admin.uploading'));
    try {
      await api.admin.publishApp(new FormData(form));
      await renderAppAdmin();
      setStatus(view.querySelector('#app-form .status'), t('appAdmin.published'), 'ok');
    } catch (err) {
      if (err.code === 'unauthorized') return renderAppAdmin();
      setStatus(status, errorMessage(err), 'error');
      button.disabled = false;
    }
  });
}
