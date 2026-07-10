import type { GitHubPackage } from '@/types'

// 模块级正则常量（避免函数内重复编译）
const RELATIVE_TIME_REGEX = /relative-time[^>]*datetime="([^"]*)"/g

export interface ScrapedRepoData {
  name: string
  full_name: string
  html_url: string
  pushed_at: string | null
  updated_at: string | null
  latest_version: string | null
  default_branch: string
  packages?: string[]
}

export function extractDefaultBranch(html: string): string {
  const branchRegex1 = /data-default-branch="([^"]+)"/
  const branchMatch1 = html.match(branchRegex1)
  if (branchMatch1) {
    return branchMatch1[1]
  }
  const branchRegex2 = /"defaultBranch":"([^"]+)"/
  const branchMatch2 = html.match(branchRegex2)
  if (branchMatch2) {
    return branchMatch2[1]
  }
  const branchRegex3 = /\/tree\/([^\/"']+)/
  const branchMatch3 = html.match(branchRegex3)
  if (branchMatch3 && !branchMatch3[1].includes('/')) {
    return branchMatch3[1]
  }
  const branchRegex4 = /<span[^>]*class="[^"]*css-truncate-target[^"]*"[^>]*>([^<]+)<\/span>/
  const branchMatch4 = html.match(branchRegex4)
  if (branchMatch4) {
    return branchMatch4[1].trim()
  }
  if (html.includes('/tree/master')) return 'master'
  return 'main'
}

function getMetaContent(html: string, name: string): string | null {
  const regex = new RegExp(`<meta name="${name}" content="([^"]*)"`)
  const match = html.match(regex)
  return match ? match[1] : null
}

/** 从 LatestCommit 区块提取最新提交时间（准确，仅匹配页面顶部最新提交） */
function extractLatestCommitTime(html: string): string | null {
  // 定位 data-testid="latest-commit" 区块，截取合理长度避免误匹配
  const startIdx = html.indexOf('data-testid="latest-commit"')
  if (startIdx === -1) return null
  const block = html.slice(startIdx, startIdx + 2000)
  const match = block.match(/datetime="([^"]+)"/)
  return match?.[1] ?? null
}

export function parseGitHubRepoPage(html: string): ScrapedRepoData {
  const repoName = getMetaContent(html, 'octolytics-dimension-repo_nwo') || ''
  const defaultBranch = extractDefaultBranch(html)

  let latestVersion: string | null = null
  const releaseRegex = /href="\/[^\/]+\/[^\/]+\/releases\/tag\/([^"]+)"/
  const releaseMatch = html.match(releaseRegex)
  if (releaseMatch) {
    latestVersion = releaseMatch[1]
  }

  // 从 LatestCommit 区块提取最新提交时间（准确）
  const lastCommitTime = extractLatestCommitTime(html)

  return {
    name: repoName.split('/')[1] || '',
    full_name: repoName,
    html_url: `https://github.com/${repoName}`,
    pushed_at: lastCommitTime,
    updated_at: lastCommitTime,
    latest_version: latestVersion,
    default_branch: defaultBranch
  }
}

function extractPackageName(html: string, repoPath?: string): string | null {
  const titleRegex = /<title>Package\s+([^\s·]+)\s+·/
  const titleMatch = html.match(titleRegex)
  if (titleMatch) return titleMatch[1].trim()

  const nameRegex = /<h1[^>]*class="[^"]*f3[^"]*"[^>]*>([^<]+)</
  const nameMatch = html.match(nameRegex)
  if (nameMatch) return nameMatch[1].trim()

  const dockerNameRegex = /docker pull ghcr\.io\/[^\/]+\/([^:]+):/
  const dockerNameMatch = html.match(dockerNameRegex)
  if (dockerNameMatch) return dockerNameMatch[1].trim()

  if (repoPath) return repoPath.split('/')[1].toLowerCase()
  return null
}

function extractPackageVersion(html: string): string | null {
  const dockerPullRegex = /docker pull ghcr\.io\/[^\/]+\/[^:]+:([^\s"@]+)/
  const dockerPullMatch = html.match(dockerPullRegex)
  if (dockerPullMatch) return dockerPullMatch[1]

  const versionRegex = /href="\/[^\/]+\/pkgs\/container\/[^\/]+\/(\d+[^"]*)"/g
  const versionMatches = [...html.matchAll(versionRegex)]
  if (versionMatches.length > 0) return versionMatches[0][1]

  const versionTextRegex = /\b(v?\d+\.\d+\.\d+[a-zA-Z0-9\-\.]*)\b/g
  const versionTextMatches = [...html.matchAll(versionTextRegex)]
  if (versionTextMatches.length > 0) return versionTextMatches[0][1]

  const containerUrlRegex = /ghcr\.io\/[^\/]+\/[^:]+:([^\s"@]+)/g
  const containerMatches = [...html.matchAll(containerUrlRegex)]
  if (containerMatches.length > 0) return containerMatches[0][1]

  const headingVersionRegex = /<(h2|h3|div)[^>]*>\s*(v?\d+\.\d+\.\d+[a-zA-Z0-9\-\.]*)\s*<\/(h2|h3|div)>/i
  const headingMatch = html.match(headingVersionRegex)
  if (headingMatch) return headingMatch[2]

  return null
}

function extractPackageUpdateTime(html: string): string | null {
  const h3TimeRegex = /<h3[^>]*title="([^"]+)"[^>]*>\d+\s+(hour|day|month|minute|week|year)s?\s+ago<\/h3>/
  const h3TimeMatch = html.match(h3TimeRegex)
  if (h3TimeMatch) return h3TimeMatch[1]

  const timeMatches = [...html.matchAll(RELATIVE_TIME_REGEX)]
  if (timeMatches.length > 0) return timeMatches[0][1]

  const timeTagRegex = /<time[^>]*datetime="([^"]*)"/g
  const timeTagMatches = [...html.matchAll(timeTagRegex)]
  if (timeTagMatches.length > 0) return timeTagMatches[0][1]

  return null
}

export function parseGitHubPackagePage(html: string, repoPath: string): GitHubPackage | null {
  try {
    const name = extractPackageName(html, repoPath)
    if (!name) return null

    const latestVersion = extractPackageVersion(html)
    const updateTime = extractPackageUpdateTime(html)

    const pkg: GitHubPackage = {
      name,
      latest_version: latestVersion || 'latest',
      updated_at: updateTime,
      package_type: 'container',
      html_url: `https://github.com/packages/container/${name}`,
      created_at: updateTime,
      id: 0,
      owner: { login: repoPath ? repoPath.split('/')[0] : '' }
    }

    return pkg
  } catch {
    // HTML解析失败（非严重错误，返回 null 由调用方处理）
  }

  return null
}
