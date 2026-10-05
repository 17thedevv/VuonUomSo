import { describe, it, expect, beforeEach } from 'vitest'
import {
  organizationRepository,
  batchRepository,
  contactRepository,
  orderRepository,
  reservationRepository,
  settingsRepository
} from '../repositories'
import { resetDemoData, clearAllData } from '../seed'
import { availableQuantityForBatch, reservedQuantityForBatch } from '../../domain/quantity'
import type { Organization } from '../../domain/organization'

describe('Repository & Persistence Boundary', () => {
  beforeEach(async () => {
    await clearAllData()
  })

  it('persists organization and retrieves it accurately (write -> reload)', async () => {
    const testOrg: Organization = {
      id: 'org_test_123',
      name: 'Vườn Ươm Hữu Lũng',
      capabilities: ['produce', 'sell']
    }

    // Write organization
    await organizationRepository.save(testOrg)

    // Read back
    const retrieved = await organizationRepository.getCurrent()

    expect(retrieved).not.toBeNull()
    expect(retrieved?.id).toBe(testOrg.id)
    expect(retrieved?.name).toBe('Vườn Ươm Hữu Lũng')
    expect(retrieved?.capabilities).toEqual(['produce', 'sell'])
  })

  it('resets demo data into standard state with correct values and derived quantities', async () => {
    // Reset to demo
    await resetDemoData()

    // Verify Organization
    const org = await organizationRepository.getCurrent()
    expect(org).not.toBeNull()
    expect(org?.name).toBe('Vườn Hồng Anh')
    expect(org?.capabilities).toEqual(['produce', 'sell', 'aggregate', 'transport'])

    // Verify Settings
    const onboarded = await settingsRepository.get('onboarding_completed')
    const mode = await settingsRepository.get('app_mode')
    expect(onboarded).toBe('true')
    expect(mode).toBe('demo')

    // Verify Contacts
    const contacts = await contactRepository.getAll()
    const names = contacts.map((c) => c.name)
    expect(names).toContain('Anh Hùng')
    expect(names).toContain('Chị Lan')
    expect(names).toContain('Vườn Thảo')
    expect(names).toContain('Vườn Hồng')
    expect(names).toContain('Vườn An')

    // Verify Batches & Quantities
    const batches = await batchRepository.getAll()
    expect(batches.length).toBe(3)

    const bv16 = batches.find((b) => b.code === 'BV16 #12')
    expect(bv16).toBeDefined()
    expect(bv16?.initialQuantity).toBe(50000)
    expect(bv16?.currentQuantity).toBe(45200)
    expect(bv16?.readyQuantity).toBe(32000)
    expect(bv16?.status).toBe('ready')

    const reservations = await reservationRepository.getAll()
    expect(reservations.length).toBeGreaterThan(0)

    // Test derived BV16 calculations: ready: 32000, reserved: 10000 => available: 22000
    const bv16Reserved = reservedQuantityForBatch(bv16!.id, reservations)
    const bv16Available = availableQuantityForBatch(bv16!, reservations)
    expect(bv16Reserved).toBe(10000)
    expect(bv16Available).toBe(22000)

    // Verify AH1 #07
    const ah1 = batches.find((b) => b.code === 'AH1 #07')
    expect(ah1).toBeDefined()
    expect(ah1?.currentQuantity).toBe(30100)
    expect(ah1?.status).toBe('nearly_ready')

    // Verify BV523 #03
    const bv523 = batches.find((b) => b.code === 'BV523 #03')
    expect(bv523).toBeDefined()
    expect(bv523?.currentQuantity).toBe(18400)
    expect(bv523?.preferredSellBefore).toBeDefined()
    expect(bv523?.status).toBe('ready')

    // Verify Orders
    const orders = await orderRepository.getAll()
    expect(orders.length).toBe(3)
    const hungOrder = orders.find((o) => o.id === 'order_hung_01')
    expect(hungOrder?.variety).toBe('Bạch đàn BV16')
    expect(hungOrder?.requestedQuantity).toBe(30000)

    const lanOrder = orders.find((o) => o.id === 'order_lan_01')
    expect(lanOrder?.variety).toBe('Bạch đàn BV16')
    expect(lanOrder?.requestedQuantity).toBe(50000)

    const namOrder = orders.find((o) => o.id === 'order_nam_01')
    expect(namOrder?.variety).toBe('Keo lai AH1')
    expect(namOrder?.status).toBe('shipped')
  })

  it('clears all tables when requested', async () => {
    await resetDemoData()
    await clearAllData()

    const org = await organizationRepository.getCurrent()
    const batches = await batchRepository.getAll()
    const contacts = await contactRepository.getAll()
    const orders = await orderRepository.getAll()
    const onboarded = await settingsRepository.get('onboarding_completed')

    expect(org).toBeNull()
    expect(batches).toHaveLength(0)
    expect(contacts).toHaveLength(0)
    expect(orders).toHaveLength(0)
    expect(onboarded).toBeNull()
  })
})
