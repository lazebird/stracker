import type { SiteStatus } from '@/types'
import { SITE_TYPE } from '@/services/github-constants'

export function formatTime(timeString: string): string {
  try {
    return new Date(timeString).toLocaleString('zh-CN')
  } catch {
    return timeString
  }
}

export function getStatusText(status: string): string {
  switch (status) {
    case 'success': return '正常'
    case 'error': return '错误'
    case 'loading': return '加载中'
    default: return status
  }
}

export function getCodeUpdateTime(site: SiteStatus): string {
  if (site.type === SITE_TYPE.DOCKER_HUB) return '-'
  return site.lastCommitTime ? formatTime(site.lastCommitTime) : '-'
}

export function getReleaseVersion(site: SiteStatus): string {
  return site.type === SITE_TYPE.GITHUB ? (site.latestVersion || '-') : '-'
}

export function getReleaseUpdateTime(site: SiteStatus): string {
  return site.type === SITE_TYPE.GITHUB ? (site.lastUpdateTime ? formatTime(site.lastUpdateTime) : '-') : '-'
}

export function getPackageVersion(site: SiteStatus): string {
  if (site.type === SITE_TYPE.GITHUB) return site.packageVersion || '-'
  if (site.type === SITE_TYPE.DOCKER_HUB) return site.latestVersion || '-'
  return '-'
}

export function getPackageUpdateTime(site: SiteStatus): string {
  if (site.type === SITE_TYPE.GITHUB) return site.packageUpdateTime ? formatTime(site.packageUpdateTime) : '-'
  if (site.type === SITE_TYPE.DOCKER_HUB) return site.lastUpdateTime ? formatTime(site.lastUpdateTime) : '-'
  return '-'
}
