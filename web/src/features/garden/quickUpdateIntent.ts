export interface QuickUpdateIntent {
  kind: 'inventory' | 'ready'
  batchId: string
}

/** Navigation metadata only. The detail screen still loads the authoritative facts. */
export function readQuickUpdateIntent(value: unknown, routeId: string | undefined): QuickUpdateIntent | undefined {
  if (!value || typeof value !== 'object') return
  const candidate = value as Record<string, unknown>
  if ((candidate.kind === 'inventory' || candidate.kind === 'ready') &&
    typeof candidate.batchId === 'string' && candidate.batchId.trim() && candidate.batchId === routeId) {
    return { kind: candidate.kind, batchId: candidate.batchId }
  }
}
