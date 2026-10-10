import { describe, expect, it } from 'vitest'
import { customerOrderReferences } from '../customerOrderReference'
import { customerCallHref, customerReturnPath } from '../customerNavigation'

describe('B2 references and local navigation', () => {
  it('B210/B211 uses distinct deterministic references despite prefix/suffix collisions and reorder', () => {
    const ids = ['prefix-same-tail', 'prefix-different-tail', 'prefix', 'prefix-different-tall', 'other-same-tail']
    const a = customerOrderReferences(ids)
    expect(new Set(a.values()).size).toBe(ids.length)
    expect(a.get('prefix')).toBe('Đơn · prefix')
    const b = customerOrderReferences([...ids].reverse())
    for (const id of ids) expect(b.get(id)).toBe(a.get(id))
    expect(() => customerOrderReferences(['same', 'same'])).toThrow()
  })
  it('B220 allows only exact actual customer ID, including safe encoded ID', () => {
    expect(customerReturnPath('/customers/customer-a', 'customer-a')).toBe('/customers/customer-a')
    expect(customerReturnPath('/customers/kh%C3%A1ch', 'khách')).toBe('/customers/kh%C3%A1ch')
    expect(customerReturnPath('/customers/customer-b', 'customer-a')).toBeUndefined()
    expect(customerReturnPath('/customers/%2e%2e', '..')).toBeUndefined()
  })
  it.each([undefined, null, 1, '/orders', '//evil.test/customers/customer-a', 'https://evil.test/customers/customer-a', '/customers/customer-a?next=https://evil.test', '/customers/customer-a#x', '/customers/%', '/customers/../orders', '/customers/customer-a\\evil'])('rejects arbitrary return %s', value => {
    expect(customerReturnPath(value, 'customer-a')).toBeUndefined()
  })
  it('B207 phone allows a native tel link only for restricted numeric shape', () => {
    expect(customerCallHref('+84 (912) 345-678')).toBe('tel:+84912345678')
    expect(customerCallHref('0912345678')).toBe('tel:0912345678')
  })
  it.each([undefined, '', 'x', 'javascript:alert(1)', '0912\n345678', '0912345678;123', '0912345678?x=1', '+1234567890123456', '\u202e0912345678'])('rejects unsafe or missing phone %s', value => {
    expect(customerCallHref(value)).toBeUndefined()
  })
})
