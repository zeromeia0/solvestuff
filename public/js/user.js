// Student identity and progress live only on the device (no accounts).
// Keep it behind this module so it can later move to a server or to
// native storage in the mobile app without touching the views.
const USER_KEY = 'solvestuff.user';
const progressKey = (name) => `solvestuff.done.${name.trim().toLowerCase()}`;

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

let user = read(USER_KEY, null);
let done = new Set(user ? read(progressKey(user.name), []) : []);

export const getUser = () => user;

export function saveUser(next) {
  if (user && next.name !== user.name) {
    write(progressKey(next.name), [...done]);
    write(progressKey(user.name), null);
  } else if (!user) {
    done = new Set(read(progressKey(next.name), []));
  }
  user = { name: next.name, level: next.level };
  write(USER_KEY, user);
}

export function logout() {
  user = null;
  done = new Set();
  write(USER_KEY, null);
}

export const isDone = (sheetId) => done.has(sheetId);

export function setDone(sheetId, value) {
  if (value) done.add(sheetId);
  else done.delete(sheetId);
  write(progressKey(user.name), [...done]);
}

export function resetProgress() {
  done = new Set();
  write(progressKey(user.name), null);
}
