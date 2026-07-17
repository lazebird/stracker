import type { SiteStatus } from '@/types'

export interface SiteStatusWithSnapshot extends SiteStatus {
  isNew?: boolean
  hasChanges?: boolean
}

const COMPARED_FIELDS: (keyof SiteStatus)[] = [
  'latestVersion',
  'packageVersion',
  'lastCommitTime',
  'packageUpdateTime',
]

const hasFieldChanged = (field: keyof SiteStatus, site: SiteStatus, snapshot: SiteStatus): boolean =>
  site[field] != null && snapshot[field] != null && site[field] !== snapshot[field]

export function compareWithSnapshot(
  currentSites: SiteStatus[],
  snapshotSites: SiteStatusWithSnapshot[]
): SiteStatusWithSnapshot[] {
  if (!Array.isArray(snapshotSites)) {
    return currentSites.map(site => ({ ...site, isNew: true }))
  }

  const snapshotMap = new Map(snapshotSites.map(site => [site.name, site]))

  return currentSites.map(site => {
    const snapshot = snapshotMap.get(site.name)
    if (!snapshot) {
      return { ...site, isNew: true }
    }

    const hasChanges = COMPARED_FIELDS.some(field => hasFieldChanged(field, site, snapshot))
    return { ...site, hasChanges }
  })
}
