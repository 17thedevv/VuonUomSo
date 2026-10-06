import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  buildValidationExportData,
  exportValidationData,
  generateValidationExportFilename,
  downloadValidationExportFile,
  validateValidationExport,
  VALIDATION_EXPORT_FORMAT,
  VALIDATION_EXPORT_FORMAT_VERSION
} from '../validationExport'
import { validationRepository } from '../validation.repository'
import type { PilotSession, ValidationEvent, VuonUomValidationExportV1 } from '../validation.types'

describe('Validation Export & Privacy Controls', () => {
  beforeEach(async () => {
    await validationRepository.clearValidationData()
  })

  describe('validateValidationExport', () => {
    const validSample: VuonUomValidationExportV1 = {
      format: 'vuonuom-validation',
      formatVersion: 1,
      exportedAt: '2026-10-06T15:00:00.000Z',
      summary: {
        totalParticipants: 1,
        totalSessions: 1,
        completedSessions: 1,
        activeSessions: 0,
        returningParticipants: 0,
        activation: { totalParticipants: 1, a1Count: 1, a2Count: 1, a3Count: 0 },
        tasks: [],
        support: { none: 1, once: 0, few: 0, many: 0 },
        willingnessToPay: { zero: 0, under_50k: 1, '50_100k': 0, '100_200k': 0, over_200k: 0, unsure: 0 },
        returnIntention: { yes: 1, maybe: 0, no: 0 },
        mostUsefulArea: { stock: 1, orders: 0, reservation: 0, shipment: 0, dossier: 0, backup: 0, other: 0 },
        evidence: {
          activatedA2: { current: 1, target: '>= 5', met: false },
          returned: { current: 0, target: '>= 3', met: false },
          positiveWtp: { current: 1, target: '>= 3', met: false },
          heavySupport: { current: 0, total: 1 }
        }
      },
      sessions: [
        {
          id: 'ps_01',
          participantCode: 'P01',
          consent: 'accepted',
          startedAt: '2026-10-06T14:00:00.000Z',
          endedAt: '2026-10-06T14:30:00.000Z'
        }
      ],
      events: [
        {
          id: 'ev_01',
          sessionId: 'ps_01',
          participantCode: 'P01',
          mode: 'pilot',
          type: 'action_completed',
          action: 'batch_created',
          createdAt: '2026-10-06T14:10:00.000Z'
        }
      ]
    }

    it('accepts a valid validation export envelope', () => {
      const result = validateValidationExport(validSample)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects non-object or null input', () => {
      expect(validateValidationExport(null).valid).toBe(false)
      expect(validateValidationExport('invalid string').valid).toBe(false)
    })

    it('rejects wrong format name or version', () => {
      const wrongFormat = { ...validSample, format: 'vuonuom-backup' }
      const res1 = validateValidationExport(wrongFormat)
      expect(res1.valid).toBe(false)
      expect(res1.errors[0]).toContain('Định dạng không hợp lệ')

      const wrongVersion = { ...validSample, formatVersion: 2 }
      const res2 = validateValidationExport(wrongVersion)
      expect(res2.valid).toBe(false)
      expect(res2.errors[0]).toContain('Phiên bản định dạng không hỗ trợ')
    })

    it('rejects invalid or unparseable exportedAt date', () => {
      const badDate = { ...validSample, exportedAt: 'not-a-date' }
      const res = validateValidationExport(badDate)
      expect(res.valid).toBe(false)
      expect(res.errors[0]).toContain('Thời điểm xuất (exportedAt) không phải là chuỗi ngày giờ ISO')
    })

    it('strictly forbids inclusion of business entities (batches, orders, contacts, dossiers, etc.)', () => {
      const forbiddenPayloads = [
        { ...validSample, batches: [{ id: 'b1' }] },
        { ...validSample, orders: [{ id: 'o1' }] },
        { ...validSample, contacts: [{ id: 'c1' }] },
        { ...validSample, dossiers: [{ id: 'd1' }] },
        { ...validSample, organizations: [{ id: 'org1' }] }
      ]

      for (const payload of forbiddenPayloads) {
        const res = validateValidationExport(payload)
        expect(res.valid).toBe(false)
        expect(res.errors.some((e) => e.includes('Vi phạm ranh giới dữ liệu'))).toBe(true)
      }
    })

    it('strictly enforces participant code privacy and forbids email, phone, and pure-digit PII', () => {
      const piiSamples = [
        'user@example.com',
        '0912345678',
        '+84988111222',
        '1234567',
        'Anh Nam'
      ]

      for (const piiCode of piiSamples) {
        const payload = {
          ...validSample,
          sessions: [
            {
              id: 'ps_bad',
              participantCode: piiCode,
              consent: 'accepted' as const,
              startedAt: '2026-10-06T14:00:00.000Z'
            }
          ]
        }
        const res = validateValidationExport(payload)
        expect(res.valid).toBe(false)
        expect(res.errors.some((e) => e.includes('Vi phạm ranh giới ẩn danh'))).toBe(true)
      }

      // Check event participantCode as well
      const badEventPayload = {
        ...validSample,
        events: [
          {
            id: 'ev_bad',
            sessionId: 'ps_01',
            participantCode: '0988776655',
            mode: 'pilot' as const,
            type: 'action_completed' as const,
            action: 'batch_created' as const,
            createdAt: '2026-10-06T14:10:00.000Z'
          }
        ]
      }
      const resEvent = validateValidationExport(badEventPayload)
      expect(resEvent.valid).toBe(false)
      expect(resEvent.errors.some((e) => e.includes('Vi phạm ranh giới ẩn danh'))).toBe(true)
    })
  })

  describe('buildValidationExportData', () => {
    it('builds a complete export with summary and guarantees zero business records', async () => {
      const session: PilotSession = {
        id: 'sess_exp_01',
        participantCode: 'P01',
        consent: 'accepted',
        startedAt: '2026-10-06T09:00:00.000Z',
        endedAt: '2026-10-06T09:40:00.000Z',
        supportLevel: 'none',
        wouldUseNextWeek: 'yes',
        willingnessToPay: '50_100k',
        mostUsefulArea: 'stock'
      }
      const event: ValidationEvent = {
        id: 'evt_exp_01',
        sessionId: 'sess_exp_01',
        participantCode: 'P01',
        mode: 'pilot',
        type: 'action_completed',
        action: 'batch_created',
        createdAt: '2026-10-06T09:15:00.000Z'
      }

      await validationRepository.savePilotSession(session)
      await validationRepository.recordValidationEvent(event)

      const { exportData, jsonString } = await buildValidationExportData()

      expect(exportData.format).toBe(VALIDATION_EXPORT_FORMAT)
      expect(exportData.formatVersion).toBe(VALIDATION_EXPORT_FORMAT_VERSION)
      expect(exportData.sessions).toHaveLength(1)
      expect(exportData.sessions[0].participantCode).toBe('P01')
      expect(exportData.events).toHaveLength(1)
      expect(exportData.summary.totalParticipants).toBe(1)
      expect(exportData.summary.completedSessions).toBe(1)
      expect(exportData.summary.willingnessToPay['50_100k']).toBe(1)

      // Zero business data keys in exportData
      const record = exportData as unknown as Record<string, unknown>
      expect(record.batches).toBeUndefined()
      expect(record.orders).toBeUndefined()
      expect(record.contacts).toBeUndefined()
      expect(record.dossiers).toBeUndefined()

      // Round-trip parse check
      const parsed = JSON.parse(jsonString)
      expect(parsed.format).toBe('vuonuom-validation')
      expect(parsed.sessions[0].id).toBe('sess_exp_01')
    })

    it('strictly excludes demo mode sessions and events by default to prevent contamination', async () => {
      const pilotSession: PilotSession = {
        id: 'sess_pilot',
        participantCode: 'P01',
        consent: 'accepted',
        startedAt: '2026-10-06T09:00:00.000Z',
        endedAt: '2026-10-06T09:40:00.000Z',
        mode: 'pilot'
      }
      const demoSession: PilotSession = {
        id: 'sess_demo',
        participantCode: 'DEMO01',
        consent: 'accepted',
        startedAt: '2026-10-06T10:00:00.000Z',
        endedAt: '2026-10-06T10:30:00.000Z',
        mode: 'demo'
      }
      const pilotEvent: ValidationEvent = {
        id: 'evt_pilot',
        sessionId: 'sess_pilot',
        participantCode: 'P01',
        mode: 'pilot',
        type: 'action_completed',
        action: 'batch_created',
        createdAt: '2026-10-06T09:15:00.000Z'
      }
      const demoEvent: ValidationEvent = {
        id: 'evt_demo',
        sessionId: 'sess_demo',
        participantCode: 'DEMO01',
        mode: 'demo',
        type: 'action_completed',
        action: 'shipment_completed',
        createdAt: '2026-10-06T10:15:00.000Z'
      }

      await validationRepository.savePilotSession(pilotSession)
      await validationRepository.savePilotSession(demoSession)
      await validationRepository.recordValidationEvent(pilotEvent)
      await validationRepository.recordValidationEvent(demoEvent)

      // Default export: includeDemo = false
      const { exportData } = await buildValidationExportData()

      expect(exportData.sessions).toHaveLength(1)
      expect(exportData.sessions[0].id).toBe('sess_pilot')
      expect(exportData.events).toHaveLength(1)
      expect(exportData.events[0].id).toBe('evt_pilot')
      expect(exportData.summary.totalParticipants).toBe(1)

      // Explicitly including demo:
      const withDemo = await buildValidationExportData({ includeDemo: true })
      expect(withDemo.exportData.sessions).toHaveLength(2)
      expect(withDemo.exportData.events).toHaveLength(2)
      expect(withDemo.exportData.summary.totalParticipants).toBe(2)
    })
  })

  describe('generateValidationExportFilename', () => {
    it('produces formatted filename matching vuon-uom-validation-YYYY-MM-DD-HHmm.json', () => {
      const testDate = new Date(2026, 9, 7, 8, 30) // 2026-10-07 08:30
      const filename = generateValidationExportFilename(testDate)
      expect(filename).toBe('vuon-uom-validation-2026-10-07-0830.json')
    })
  })

  describe('downloadValidationExportFile and exportValidationData', () => {
    it('triggers browser blob download', async () => {
      const createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-url')
      const revokeObjectURLSpy = vi.fn()
      window.URL.createObjectURL = createObjectURLSpy
      window.URL.revokeObjectURL = revokeObjectURLSpy

      const appendSpy = vi.spyOn(document.body, 'appendChild')
      const removeSpy = vi.spyOn(document.body, 'removeChild')

      // Test direct downloadValidationExportFile
      downloadValidationExportFile('{"format":"vuonuom-validation"}', 'test.json')
      expect(createObjectURLSpy).toHaveBeenCalled()

      // Test exportValidationData
      const { filename, exportData } = await exportValidationData()

      expect(filename).toMatch(/^vuon-uom-validation-\d{4}-\d{2}-\d{2}-\d{4}\.json$/)
      expect(exportData.format).toBe('vuonuom-validation')
      expect(createObjectURLSpy).toHaveBeenCalled()
      expect(appendSpy).toHaveBeenCalled()
      expect(removeSpy).toHaveBeenCalled()
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')

      appendSpy.mockRestore()
      removeSpy.mockRestore()
    })
  })
})
