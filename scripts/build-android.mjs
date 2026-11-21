// npm run android: builds the dashboard for the Android app (folder android/).
// The hub address comes from VITE_HUB_URL in .env.mobile and is fixed inside the app.
import { build, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = loadEnv('mobile', root, 'VITE_')
const url = String(env.VITE_HUB_URL || '').trim().replace(/\/+$/, '').replace(/\/api\/v1$/, '')
const stop = (msg) => { console.error(`\n  ${msg}\n`); process.exit(1) }

if (!url || /your-hub/.test(url)) stop('Put your hub address in .env.mobile first, for example:\n  VITE_HUB_URL=https://nextup-hub-api.onrender.com')
let u
try { u = new URL(url) } catch { stop(`VITE_HUB_URL in .env.mobile is not a web address: ${url}`) }
if (u.protocol !== 'https:') stop(`The app needs an https:// address (your Render address). Got: ${url}`)

const outDir = resolve(root, 'android/app/src/main/assets/www')
await build({ root, mode: 'mobile', logLevel: 'warn', build: { outDir, emptyOutDir: true } })
console.log(`\n  Built the app's screens for ${u.host} into android/app/src/main/assets/www`)
console.log('  Next: build the APK (see ANDROID.md).\n')
