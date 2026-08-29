# pOZ-Link

A grid path-connection puzzle. Drag a line from each coloured dot to its twin;
lines may not cross, and the board is only solved when every cell is covered.
Six tiers from a 5×5 warm-up to a 14×14 Master board, 100 levels each,
generated deterministically so every player gets the same level 42.

**Play it: [oubata.github.io/color-link](https://oubata.github.io/color-link/)**
Installable on Android, iOS and desktop; works offline once loaded.

The design and rules live in [`docs/pOZle_color-link_spec_v1.0.md`](docs/pOZle_color-link_spec_v1.0.md),
which is the source of truth for this build.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

No backend, no accounts, no network calls after the first load. Progress lives
in `localStorage`.

## Commands

| Command              | What it does                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run dev`        | Dev server with hot reload                                                                                      |
| `npm run build`      | Type-check, then a production bundle in `dist/`                                                                 |
| `npm run preview`    | Serve the built `dist/` locally                                                                                 |
| `npm test`           | 188 unit tests (Vitest)                                                                                         |
| `npm run verify`     | Drives a headless browser through the app and checks the spec 12 criteria that can only be judged by running it |
| `npm run verify:pwa` | Builds, then checks the manifest, icons, service worker, and a real offline reload                              |
| `npm run icons`      | Re-rasterises the PNG icons from the artwork in `scripts/icons/generate.mjs`                                    |
| `npm run apk`        | Builds the Android debug APK (needs a JDK and the Android SDK)                                                  |
| `npm run format`     | Prettier                                                                                                        |

`npm run verify` and `npm run verify:pwa` need a Chromium-based browser. They
look for Edge and Chrome in the usual places; set `CHROME_PATH` if yours is
somewhere else.

## Deploying

The build uses a **relative base** (`base: './'` in `vite.config.ts`), so
`dist/` runs from any path on any static host without reconfiguration — a
domain root, a project subpath, even `file://`.

Everything is static. There is nothing to configure server-side beyond serving
the files.

### Netlify

Connect the repository and set:

- **Build command**: `npm run build`
- **Publish directory**: `dist`

Or from the CLI:

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

### GitHub Pages — already set up

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and
publishes on every push to `main`. It runs the unit tests first and will not
publish a red build. Nothing to do but push:

```bash
git push
```

Pages is configured with GitHub Actions as its source. The relative base means
the project site at `https://oubata.github.io/color-link/` works with no extra
configuration.

After a deploy, check the live site rather than trusting the green tick:

```bash
npm run verify:pwa -- --url=https://oubata.github.io/color-link/
```

That runs the manifest, icon, service-worker and offline checks against the
deployed URL. The one check it skips is stopping the origin server, which is
not ours to stop; offline there rests on network emulation alone.

### Any other static host

Build and copy `dist/` wherever it is served from:

```bash
npm run build
```

Two things a host must get right for the installable app to work:

- **Serve over HTTPS.** Service workers are refused on plain HTTP, apart from
  `localhost`. Both Netlify and GitHub Pages do this for you.
- **Do not cache `sw.js` or `index.html` for long.** The hashed files under
  `assets/` are immutable and can be cached forever; the service worker and the
  HTML entry must be revalidated, or an update will not reach anyone. Netlify
  and GitHub Pages default to sensible values here.

## Installing it

The build is a PWA: an app manifest, maskable icons, and a service worker that
precaches the whole app shell.

- **Android / Chrome**: the browser offers "Install app" once the page has been
  visited. Also under ⋮ → _Add to Home screen_.
- **iOS / Safari**: Share → _Add to Home Screen_. iOS does not prompt on its own.
- **Desktop Chrome / Edge**: an install icon appears in the address bar.

After the first load the app works with no network at all — levels are
generated on the device, so every one of the 600 is available offline.
`npm run verify:pwa` proves this by stopping the server and playing a level to
completion.

## Android

```bash
npm run apk
```

Builds `android/app/build/outputs/apk/debug/app-debug.apk` — a self-contained
app with the whole game inside it. No server, no URL bar, offline from first
launch. Needs a JDK and the Android SDK, with `ANDROID_HOME` pointing at the
SDK. Install it on a connected phone with:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

The APK is debug-signed, so Android asks you to allow installation from an
unknown source the first time.

Two things worth knowing about the native build:

- It uses `vite build --mode native`, which **drops the service worker**.
  Capacitor serves every app version from the same `https://localhost` origin,
  so a worker left by an older install would keep serving its cached assets and
  a freshly installed APK would show the old app. Inside the APK the files are
  local anyway, so the worker buys nothing.
- The launcher icons come from `npm run icons`, same artwork as the web icons.
  Edit `scripts/icons/generate.mjs` and re-run it; do not hand-edit the PNGs.

The Android back button is wired to the app's own back navigation, via a spare
history entry (`syncHistory` in `src/app/App.ts`). Without it, back would close
the app from any screen. The same code makes the browser's back button work on
the web.

## Layout

```
src/engine/      Pure rules: paths, cutting, undo, win. No DOM, no randomness.
src/generator/   Deterministic level generation from a seed. No DOM, no Math.random.
src/render/      Canvas board renderer and layout maths.
src/input/       Pointer and keyboard to engine operations.
src/app/         Screens, modals, state machine, progress, strings, config.
src/storage/     localStorage with schema guards.
src/audio/       Synthesised sound and haptics.
tests/           Mirrors src/.
scripts/verify/  Browser checks for the acceptance criteria.
scripts/icons/   Icon rasteriser, for the web and Android launcher icons.
scripts/android/ APK build.
android/        Capacitor project: the APK wrapper around dist/.
```

`src/engine/` and `src/generator/` are pure TypeScript and are not allowed to
import from the DOM or from `app/`, `render/` or `input/`. See
[`CLAUDE.md`](CLAUDE.md) for the rest of the conventions.
