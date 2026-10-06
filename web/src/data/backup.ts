export * from './backup/backup.types'
export * from './backup/backup.normalize'
export * from './backup/backup.validate'
export * from './backup/backup.export'
export * from './backup/backup.restore'

import { exportWorkspaceBackup } from './backup/backup.export'

/**
 * Backward compatibility helper for exporting database to JSON.
 */
export async function exportDatabaseToJson(): Promise<string> {
  const { jsonString } = await exportWorkspaceBackup()
  return jsonString
}
