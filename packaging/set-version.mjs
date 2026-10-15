// Writes the release version into wails.json so Windows file info and macOS Info.plist match the tag.
// Usage: node packaging/set-version.mjs v1.2.3
import { readFileSync, writeFileSync } from 'node:fs'

const match = /^v?(\d+\.\d+\.\d+)/.exec(process.argv[2] ?? '')
if (!match) {
  console.log(`No release version in "${process.argv[2] ?? ''}", keeping wails.json as is`)
  process.exit(0)
}

const config = JSON.parse(readFileSync('wails.json', 'utf8'))
config.info = { ...config.info, productVersion: match[1] }
writeFileSync('wails.json', `${JSON.stringify(config, null, 2)}\n`)
console.log(`Set productVersion to ${match[1]}`)
