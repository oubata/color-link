/**
 * Build the Android debug APK, end to end.
 *
 *   npm run apk
 *
 * Builds the native web bundle (no service worker — see vite.config.ts), copies
 * it into the Android project, and runs Gradle. Needs a JDK and the Android
 * SDK; `ANDROID_HOME` or `ANDROID_SDK_ROOT` must point at the SDK.
 */
import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const ANDROID = join(ROOT, 'android');
const APK = join(
  ANDROID,
  'app',
  'build',
  'outputs',
  'apk',
  'debug',
  'app-debug.apk',
);
const isWindows = process.platform === 'win32';

/**
 * `shell` is only for gradlew.bat, which Windows cannot spawn directly. Node
 * itself must be spawned without a shell, or the space in "C:\Program Files"
 * splits the command.
 */
function run(command, args, { cwd = ROOT, shell = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}

if (!existsSync(ANDROID)) {
  console.error('No android/ project. Run `npx cap add android` first.');
  process.exit(1);
}

const sdk = process.env['ANDROID_HOME'] ?? process.env['ANDROID_SDK_ROOT'];
if (!sdk || !existsSync(sdk)) {
  console.error(
    'Android SDK not found. Set ANDROID_HOME to it, e.g.\n' +
      '  %LOCALAPPDATA%\\Android\\Sdk   (Windows)\n' +
      '  ~/Library/Android/sdk         (macOS)',
  );
  process.exit(1);
}
// Gradle reads ANDROID_SDK_ROOT; keep both pointing at the same place.
process.env['ANDROID_SDK_ROOT'] = sdk;

const vite = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const cap = join(ROOT, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor');

console.log('\n1/3  building the web bundle (native mode, no service worker)');
await run(process.execPath, [vite, 'build', '--mode', 'native']);

console.log('\n2/3  copying it into the Android project');
await run(process.execPath, [cap, 'sync', 'android']);

console.log('\n3/3  running Gradle');
// An absolute path: cmd does not search the working directory, and quoting
// survives a checkout somewhere with a space in the path.
const gradlew = join(ANDROID, isWindows ? 'gradlew.bat' : 'gradlew');
await run(isWindows ? `"${gradlew}"` : gradlew, ['assembleDebug'], {
  cwd: ANDROID,
  shell: isWindows,
});

if (!existsSync(APK)) {
  console.error('\nGradle finished but no APK appeared at', APK);
  process.exit(1);
}

const mb = (statSync(APK).size / 1024 / 1024).toFixed(1);
console.log(`\nAPK ready: ${APK}  (${mb} MB)`);
console.log('Install on a connected phone with:  adb install -r "' + APK + '"');
