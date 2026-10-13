import { execSync } from 'child_process'
import { readFileSync, unlinkSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const tempOut = resolve(__dirname, '../src/api/generated/v3.temp.d.ts')
const canonicalPath = resolve(__dirname, '../src/api/generated/v3.d.ts')
const openapiPath = resolve(__dirname, '../../docs/api/v3.openapi.json')

try {
  execSync(`npx openapi-typescript "${openapiPath}" -o "${tempOut}"`, { stdio: 'inherit' })

  const generated = readFileSync(tempOut, 'utf-8').replace(/\r\n/g, '\n')
  const canonical = readFileSync(canonicalPath, 'utf-8').replace(/\r\n/g, '\n')

  if (generated !== canonical) {
    console.error('Error: web/src/api/generated/v3.d.ts is out of sync with docs/api/v3.openapi.json.')
    console.error('Please run "npm run api:generate" to regenerate.')
    process.exit(1)
  }

  console.log('API generated types are in sync with docs/api/v3.openapi.json.')
} finally {
  try {
    unlinkSync(tempOut)
  } catch {
    // Ignore cleanup error if tempOut doesn't exist
  }
}
