import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webRoot = process.cwd()
const publicFile = (name: string) => readFileSync(resolve(webRoot, 'public', name))
const sourceFile = (name: string) => readFileSync(resolve(webRoot, name), 'utf8')
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

describe('REM-05 PWA install asset integrity', () => {
  for (const [name, width, height] of [
    ['pwa-192x192.png', 192, 192],
    ['pwa-512x512.png', 512, 512],
    ['apple-touch-icon.png', 180, 180]
  ] as const) {
    it(`${name} is a real ${width}x${height} PNG, not a 1x1 placeholder`, () => {
      const png = publicFile(name)
      expect(png.length).toBeGreaterThan(1_000)
      expect(png.subarray(0, 8).equals(pngSignature)).toBe(true)
      expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR')
      expect(png.readUInt32BE(16)).toBe(width)
      expect(png.readUInt32BE(20)).toBe(height)
    })
  }

  it('serves branded SVG and a non-empty multi-size ICO favicon', () => {
    const svg = publicFile('favicon.svg').toString('utf8')
    expect(svg).toMatch(/<svg\s/)
    expect(svg).toMatch(/viewBox=/)
    const ico = publicFile('favicon.ico')
    expect(ico.length).toBeGreaterThan(1_000)
    expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0])
    expect(ico.readUInt16LE(4)).toBeGreaterThan(0)
  })

  it('HTML, manifest paths, offline assets and theme stay aligned', () => {
    const html = sourceFile('index.html')
    const config = sourceFile('vite.config.ts')
    expect(html).toContain('href="/favicon.svg"')
    expect(html).toContain('href="/favicon.ico"')
    expect(html).toContain('href="/apple-touch-icon.png"')
    expect(html).toContain('content="#15803d"')
    expect(config).toContain("theme_color: '#15803d'")
    expect(config).toContain("src: 'pwa-192x192.png'")
    expect(config).toContain("sizes: '192x192'")
    expect(config).toContain("src: 'pwa-512x512.png'")
    expect(config).toContain("sizes: '512x512'")
    expect(config).toContain("includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png']")
    expect(config).toContain('globPatterns:')
  })
})
