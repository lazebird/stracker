import type { SiteStatus } from '@/types'

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
  if (site.type === 'Docker Hub镜像') return '-'
  return site.lastCommitTime ? formatTime(site.lastCommitTime) : '-'
}

export function getReleaseVersion(site: SiteStatus): string {
  return site.type === 'GitHub网站' ? (site.latestVersion || '-') : '-'
}

export function getReleaseUpdateTime(site: SiteStatus): string {
  return site.type === 'GitHub网站' ? (site.lastUpdateTime ? formatTime(site.lastUpdateTime) : '-') : '-'
}

export function getPackageVersion(site: SiteStatus): string {
  if (site.type === 'GitHub网站') return site.packageVersion || '-'
  if (site.type === 'Docker Hub镜像') return site.latestVersion || '-'
  return '-'
}

export function getPackageUpdateTime(site: SiteStatus): string {
  if (site.type === 'GitHub网站') return site.packageUpdateTime ? formatTime(site.packageUpdateTime) : '-'
  if (site.type === 'Docker Hub镜像') return site.lastUpdateTime ? formatTime(site.lastUpdateTime) : '-'
  return '-'
}
