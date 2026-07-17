import type { SiteStatus, GitHubPackage } from '@/types'
import { parseSiteUrl } from './url-parser'
import { fetchRepoViaApi, fetchPackagesViaApi } from './github-api'
import { scrapeRepoPage, scrapeGitHubPackagesWeb } from './github-scraper'
import { getDockerHubTags } from './docker-api'
import { withFallback } from '@/utils/retry'

export class ApiService {
  static async getGitHubRepoInfo(repoPath: string): Promise<{
    repo: { pushed_at?: string; updated_at?: string; default_branch?: string };
    latestRelease: { tag_name: string; published_at: string; name: string } | null;
    packages?: string[]
  }> {
    return withFallback([
      async () => {
        const webData = await scrapeRepoPage(repoPath)

        return {
          repo: {
            pushed_at: webData.pushed_at ?? undefined,
            updated_at: webData.updated_at ?? undefined,
            default_branch: webData.default_branch
          },
          latestRelease: webData.latest_version ? {
            tag_name: webData.latest_version,
            published_at: webData.latest_release_time || webData.updated_at || webData.pushed_at || '',
            name: webData.latest_version
          } : null,
          ...(webData.packages?.length ? { packages: webData.packages } : {})
        }
      },
      async () => {
        const apiResult = await fetchRepoViaApi(repoPath)
        return {
          repo: {
            pushed_at: apiResult.repo.pushed_at,
            updated_at: apiResult.repo.updated_at,
            default_branch: apiResult.repo.default_branch ?? 'main',
          },
          latestRelease: apiResult.latestRelease ? {
            tag_name: apiResult.latestRelease.tag_name,
            published_at: apiResult.latestRelease.published_at,
            name: apiResult.latestRelease.name,
          } : null,
        }
      },
    ], {
      onError: (e, i) => console.warn(`[getGitHubRepoInfo] 策略 ${i + 1} 失败 (${repoPath}):`, e instanceof Error ? e.message : e)
    })
  }

  static async getSiteStatus(name: string, url: string, desc?: string, pkgname?: string): Promise<SiteStatus> {
    try {
      const { type, path } = parseSiteUrl(url)

      switch (type) {
        case 'github': {
          const { repo, latestRelease, packages: repoPackages } = await this.getGitHubRepoInfo(path)

          let latestPackage = await this.resolvePackage(path, pkgname, repoPackages)

          return {
            name,
            url,
            desc,
            type: 'GitHub网站',
            lastCommitTime: repo.pushed_at,
            latestVersion: latestRelease?.tag_name,
            lastUpdateTime: latestRelease?.published_at || undefined,
            packageVersion: latestPackage?.latest_version,
            packageUpdateTime: latestPackage?.updated_at || undefined,
            status: 'success'
          }
        }

        case 'docker-hub': {
          const tags = await getDockerHubTags(path)
          const latestTag = tags[0]
          return {
            name,
            url,
            desc,
            type: 'Docker Hub镜像',
            latestVersion: latestTag?.name,
            lastUpdateTime: latestTag?.last_updated,
            status: 'success'
          }
        }

        default:
          throw new Error(`不支持的网站类型: ${type}`)
      }
    } catch (error) {
      return {
        name,
        url,
        desc,
        type: '未知',
        status: 'error',
        errorMessage: error instanceof Error ? error.message : '获取数据失败'
      }
    }
  }

  // 解析package：优先指定名称 → 主页面提取 → API查找
  private static async resolvePackage(
    path: string,
    pkgname?: string,
    repoPackages?: string[]
  ): Promise<GitHubPackage | null> {
    const owner = path.split('/')[0]

    const tryFetchPackage = (name: string) =>
      scrapeGitHubPackagesWeb(`${owner}/${name}`).then(pkgs => {
        if (pkgs.length === 0) throw new Error('no package from web')
        return pkgs[0]
      })

    const strategies: Array<() => Promise<GitHubPackage>> = []

    if (pkgname) {
      strategies.push(() => tryFetchPackage(pkgname))
    }
    if (repoPackages?.length) {
      strategies.push(() => tryFetchPackage(repoPackages[0]))
    }
    strategies.push(() =>
      fetchPackagesViaApi(path, repoPackages).then(ps => {
        const pkg = ps.find(p => p.latest_version) || (ps.length > 0 ? ps[0] : null)
        if (pkg) return pkg
        throw new Error('no package from API')
      })
    )

    return withFallback(strategies).catch(() => null)
  }

  static async getAllSitesStatus(
    sites: { name: string; url: string; desc?: string; pkgname?: string }[]
  ): Promise<SiteStatus[]> {
    return Promise.all(
      sites.map(site => this.getSiteStatus(site.name, site.url, site.desc, site.pkgname))
    )
  }
}
