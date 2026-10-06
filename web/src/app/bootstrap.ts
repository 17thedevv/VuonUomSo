import { settingsRepository, organizationRepository } from '../data/repositories'

export interface BootstrapState {
  isOnboarded: boolean
  mode: 'demo' | 'pilot' | 'none'
  orgName?: string
}

/**
 * Initializes and reads the application startup state from local storage / IndexedDB.
 */
export async function bootstrapApp(): Promise<BootstrapState> {
  const [onboardedVal, modeVal, currentOrg] = await Promise.all([
    settingsRepository.get('onboarding_completed'),
    settingsRepository.get('app_mode'),
    organizationRepository.getCurrent()
  ])

  const isOnboarded = onboardedVal === 'true' && !!currentOrg
  const mode = (modeVal as 'demo' | 'pilot') || (isOnboarded ? 'pilot' : 'none')

  return {
    isOnboarded,
    mode,
    orgName: currentOrg?.name
  }
}
