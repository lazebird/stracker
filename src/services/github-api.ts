import axios from 'axios'
import type { GitHubRepo, GitHubRelease, GitHubPackage } from '@/types'
import { generatePackageNames } from '@/utils/package-names'
import { withFallback } from '@/utils/retry'
import { GITHUB_API_BASE } from './github-constants'

const githubApi = axios.create({
  baseURL: GITHUB_API_BASE,
  headers: {
    'Accept': 'application/vnd.github.v3+json',
    ...(process.env.GITHUB_TOKEN && { 'Authorization': `token ${process.env.GITHUB_TOKEN}` })
  }
})

const githubPublicApi = axios.create({
  baseURL: GITHUB_API_BASE,
  headers: {
    'Accept': 'application/vnd.github.v3+json'
  }
})

export interface RepoApiResult {
  repo: GitHubRepo
  latestRelease: GitHubRelease | null
}

async function fetchRepoWithClient(client: typeof githubApi, repoPath: string): Promise<RepoApiResult> {
  const [repoResponse, releasesResponse] = await Promise.all([
    client.get<GitHubRepo>(`/repos/${repoPath}`),
    client.get<GitHubRelease[]>(`/repos/${repoPath}/releases`, {
      params: { per_page: 1 }
    })
  ])

  return {
    repo: repoResponse.data,
    latestRelease: releasesResponse.data.length > 0 ? releasesResponse.data[0] : null
  }
}

export async function fetchRepoViaApi(repoPath: string): Promise<RepoApiResult> {
  return withFallback([
    () => fetchRepoWithClient(githubApi, repoPath),
    () => fetchRepoWithClient(githubPublicApi, repoPath),
  ], {
    onError: (e, i) => console.warn(`[fetchRepoViaApi] 策略 ${i + 1} 失败 (${repoPath}):`, e instanceof Error ? e.message : e)
  })
}

async function fetchVersionForPackage(client: typeof githubApi, owner: string, packageName: string): Promise<string> {
  try {
    const versionsResponse = await client.get<any[]>(`/orgs/${owner}/packages/container/${packageName}/versions`, {
      params: { per_page: 1 }
    })

    if (versionsResponse.data.length > 0) {
      const versionData = versionsResponse.data[0]
      const metadata = versionData.metadata || {}
      const container = metadata.container || {}
      const tags = container.tags || []
      return tags.length > 0 ? tags[0] : (versionData.name || 'latest')
    }
  } catch {
    // 版本信息获取失败（使用默认值 'latest'）
  }
  return 'latest'
}

async function tryFetchPackage(client: typeof githubApi, owner: string, packageName: string): Promise<GitHubPackage | null> {
  try {
    const response = await client.get<GitHubPackage>(`/orgs/${owner}/packages/container/${packageName}`)
    const latestVersion = await fetchVersionForPackage(client, owner, packageName)
    return { ...response.data, latest_version: latestVersion }
  } catch {
    return null
  }
}

async function findExactPackage(
  owner: string,
  names: string[]
): Promise<GitHubPackage | null> {
  for (const packageName of names) {
    let pkg = await tryFetchPackage(githubApi, owner, packageName)
    if (!pkg) {
      pkg = await tryFetchPackage(githubPublicApi, owner, packageName)
    }
    if (pkg) return pkg
  }
  return null
}

async function listAndMatchPackage(
  owner: string,
  repoName: string
): Promise<GitHubPackage[]> {
  let allPackages: GitHubPackage[] = []

  try {
    const orgResponse = await githubApi.get<{ packages: GitHubPackage[] }>(`/orgs/${owner}/packages`, {
      params: { package_type: 'container', per_page: 50 }
    })
    allPackages = allPackages.concat(orgResponse.data.packages)
  } catch {
    // 组织级别获取失败（自动尝试用户级别）
  }

  if (allPackages.length === 0) {
    try {
      const userResponse = await githubApi.get<{ packages: GitHubPackage[] }>(`/users/${owner}/packages`, {
        params: { package_type: 'container', per_page: 50 }
      })
      allPackages = allPackages.concat(userResponse.data.packages)
    } catch {
      // 用户级别也失败（返回空列表）
    }
  }

  const cleanSuffix = (name: string) => name.replace(/-(app|image|container|docker)$/i, '')

  const matched = allPackages.filter(pkg => {
    const packageName = pkg.name.toLowerCase()
    if (packageName === repoName) return true
    if (packageName.includes(repoName) || repoName.includes(packageName)) return true
    return cleanSuffix(packageName) === cleanSuffix(repoName) ||
      cleanSuffix(packageName).includes(cleanSuffix(repoName)) ||
      cleanSuffix(repoName).includes(cleanSuffix(packageName))
  })

  for (const pkg of matched) {
    pkg.latest_version = await fetchVersionForPackage(githubApi, owner, pkg.name)
  }

  return matched
}

export async function fetchPackagesViaApi(
  repoPath: string,
  knownPackages?: string[]
): Promise<GitHubPackage[]> {
  try {
    const [owner, repo] = repoPath.split('/')
    const repoName = repo.toLowerCase()

    const uniqueNames = [...new Set([
      ...(knownPackages || []),
      ...generatePackageNames(repoName),
    ])]

    // 1. 精确名称匹配（带 API token → public 双 fallback）
    const exactPkg = await findExactPackage(owner, uniqueNames)
    if (exactPkg) return [exactPkg]

    // 2. 列出组织/用户全部包 → 模糊匹配
    const matched = await listAndMatchPackage(owner, repoName)
    if (matched.length > 0) return matched

    // 3. 兜底：自动生成名称重试
    const fallbackPkg = await findExactPackage(owner, generatePackageNames(repoName))
    return fallbackPkg ? [fallbackPkg] : []
  } catch {
    return []
  }
}
