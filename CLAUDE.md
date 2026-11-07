# solvestuff — read before changing anything

The site is live at https://solvestuff.zya.me on AeonFree free hosting. **That host only runs PHP, not Node.**

## Two backends, keep them in sync

- `src/api.js` (+ `server.js`) is the Node backend, used for local dev (`make up`).
- `hosting/api/index.php` is a PHP port of it, and **that's what runs on the live site.** Same routes,
  same JSON files in `storage/`, same responses.
- **Any change to an API route, field, validation rule or error code in `src/api.js` must also be made in
  `hosting/api/index.php`.** Otherwise it works locally but is broken on the live site.
- Frontend (`public/`) changes need nothing special. It works with both backends.
- The client sends PATCH/DELETE as `POST` + `X-HTTP-Method-Override`, and also sends the token in
  `X-Authorization`. Both backends accept this. Keep it that way, because the host may block or strip the originals.

## Deploying

- `make deploy` builds `dist/htdocs`, uploads changed code over FTP, and syncs `storage/` data both ways
  (local-only changes go up, changes made on the site's admin page come down, conflicts stop the deploy).
  Credentials are in `.env` (`FTP_USER`, `FTP_PASS`). Logic is in `hosting/deploy.py`.
- On a conflict, don't pick a side yourself. Ask the user whether to run `FORCE=local make deploy` or
  `FORCE=live make deploy`.
- Never upload or overwrite live data by hand (curl/FTP). Go through `make deploy` so the sync snapshot in
  `.deploy-state/` stays correct.
- After making changes the user wants online, run `make deploy` (or tell the user to).

## Gotchas

- The host puts a JavaScript anti-bot check in front of the site, so curl/scripts get a challenge page,
  not the site. Don't try to bypass it. Ask the user to check things in their browser.
- Upload limits on the host are probably ~10 MB per file (PDFs/APKs bigger than that will fail).
- `data/curriculum.seed.json` is only used when `storage/curriculum.json` doesn't exist. Editing the seed
  doesn't change the site. Edit `storage/curriculum.json` (or use the admin page) instead.
- `storage/`, `.env`, `dist/`, `.deploy-state/`, `backups/` are not in git.

## The user

Talks casually and wants things done, not options. Make the call, do it, and give short, concrete next steps.
