import { describe, expect, it } from 'vitest'
import { formatShareText, publicLabel, type ShareFacts } from '../shareFormatter'

const facts: ShareFacts = {
  organizationName: 'Vườn Hồng Anh', generatedAt: '2026-10-10T03:30:00.000Z', includeBatchCodes: false,
  groups: [{ variety: 'MONTHONG', available: 15000, batches: [{ code: 'M07', available: 15000 }] }]
}

describe('plain public share formatter', () => {
  it('is deterministic, preserves Unicode, formats quantity and generated time in Vietnam time', () => {
    const text = formatShareText(facts)
    expect(text).toBe(formatShareText(structuredClone(facts)))
    expect(text).toContain('Vườn: Vườn Hồng Anh\nTạo lúc: 10:30, 10/10/2026')
    expect(text).toContain('MONTHONG\nCòn bán: 15.000 cây')
    expect(text).toContain('có thể thay đổi')
    expect(text).not.toContain('M07')
    expect(text).not.toMatch(/https?:|kiểm kê|giữ cho|giá/i)
  })
  it('adds only the explicitly enabled batch code breakdown', () => {
    expect(formatShareText({ ...facts, includeBatchCodes: true })).toContain('- M07: 15.000 cây')
  })
  it('neutralizes imported newlines, control and bidi characters without changing stored facts', () => {
    const imported = { ...facts, organizationName: ' Vườn\r\nKhách:\tBí mật\u202e ', groups: [{ variety: 'Giống\u2028Mới\u0000', available: 15, batches: [{ code: 'M\n07', available: 15 }] }], includeBatchCodes: true }
    const before = structuredClone(imported)
    const text = formatShareText(imported)
    expect(text).toContain('Vườn: Vườn Khách: Bí mật\n')
    expect(text).toContain('Giống Mới\nCòn bán: 15 cây\n- M 07: 15 cây')
    for (const control of ['\u0000', '\u202e', '\u2028', '\r', '\t']) expect(text).not.toContain(control)
    expect(imported).toEqual(before)
  })
  it.each(['', '   ', '\u0000\u200b', null, undefined, 42])('rejects an invalid public label %s rather than inventing a nursery', value => {
    expect(() => publicLabel(value)).toThrow()
    expect(() => formatShareText({ ...facts, organizationName: value as string })).toThrow()
  })
  it('keeps long Vietnamese names/codes complete', () => {
    const name = 'Vườn cây giống Đắk Lắk '.repeat(30).trim()
    const code = 'LÔ-ƯƠM-'.repeat(80)
    const text = formatShareText({ ...facts, organizationName: name, includeBatchCodes: true, groups: [{ variety: name, available: 15, batches: [{ code, available: 15 }] }] })
    expect(text).toContain(name)
    expect(text).toContain(code)
  })
  it('rejects invalid timestamps and empty content', () => {
    expect(() => formatShareText({ ...facts, generatedAt: 'invalid' })).toThrow()
    expect(() => formatShareText({ ...facts, groups: [] })).toThrow()
  })
})
