import fs from 'fs';
import path from 'path';

const swPath = path.join(process.cwd(), 'public', 'sw.js');
let content = fs.readFileSync(swPath, 'utf8');

const newVersion = Date.now();
content = content.replace(/CACHE_NAME = "tasker-agf-v\d+"/, `CACHE_NAME = "tasker-agf-v${newVersion}"`);

fs.writeFileSync(swPath, content);
console.log(`[SW-BUMP] Bumped sw.js CACHE_NAME to tasker-agf-v${newVersion}`);
