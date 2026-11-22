// Tanıtım görselini (1024×500) store/feature-graphic.html'den üretir. Kullanım: node store/tools/feature.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, sleep } from './cdp.mjs';

const p = await launch({ width: 1024, height: 500, scale: 1 });
await p.send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 500, deviceScaleFactor: 1, mobile: false });
await p.goto(pathToFileURL(fileURLToPath(new URL('../feature-graphic.html', import.meta.url))).href);
await p.eval('document.fonts.ready.then(() => true)');
await sleep(300);
await p.shot(fileURLToPath(new URL('../assets/feature-graphic.png', import.meta.url)));
p.close();
process.exit(0);
