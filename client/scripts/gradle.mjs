// android/ klasöründe Gradle'ı çalıştırır (Windows'ta gradlew.bat, diğerlerinde ./gradlew).
// JAVA_HOME ayarlı değilse Android Studio'nun kendi Java'sını (jbr) kullanır.
// Kullanım: node scripts/gradle.mjs bundleRelease
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../android/', import.meta.url));
const win = process.platform === 'win32';
const env = { ...process.env };

if (!env.JAVA_HOME) {
  const candidates = win
    ? ['C:\\Program Files\\Android\\Android Studio\\jbr']
    : ['/Applications/Android Studio.app/Contents/jbr/Contents/Home', '/opt/android-studio/jbr'];
  const found = candidates.find((p) => existsSync(p));
  if (found) env.JAVA_HOME = found;
}

// Tam yol: bazı Windows ayarlarında (NoDefaultCurrentDirectoryInExePath) bulunulan klasör aranmaz.
const gradlew = fileURLToPath(new URL(win ? '../android/gradlew.bat' : '../android/gradlew', import.meta.url));
const result = spawnSync(win ? `"${gradlew}"` : gradlew, process.argv.slice(2), {
  cwd,
  env,
  stdio: 'inherit',
  shell: win,
});
process.exit(result.status ?? 1);
