/** Allow only this exact contact's local detail route; callers supply verified identity. */
export function customerReturnPath(value: unknown, customerId: string): string | undefined {
  if (typeof value !== 'string' || !customerId.trim() || customerId === '.' || customerId === '..' || /[\p{Cc}\p{Cf}]/u.test(customerId)) return undefined
  const match = /^\/customers\/([^/?#\\]+)$/.exec(value)
  if (!match) return undefined
  try {
    return decodeURIComponent(match[1]) === customerId ? `/customers/${encodeURIComponent(customerId)}` : undefined
  } catch { return undefined }
}

/** Imported phone is display text; a tel URL requires a restricted, explicit phone shape. */
export function customerCallHref(phone: unknown): string | undefined {
  if (typeof phone !== 'string' || !/^\+?[0-9 ()-]+$/.test(phone)) return undefined
  const number = phone.replace(/[ ()-]/g, '')
  return /^\+?\d{3,15}$/.test(number) ? `tel:${number}` : undefined
}
