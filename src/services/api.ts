import axios from 'axios'
import type { SiteStatus, GitHubRepo, GitHubRelease, DockerHubTag, GitHubPackage } from '@/types'

const GITHUB_API = 'https://api.github.com'
const DOCKER_HUB_API = 'https://hub.docker.com/v2/repositories'

export class ApiService {
  static async getGitHubRepoInfo(repoPath: string): Promise<{ repo: GitHubRepo; latestRelease: GitHubRelease | null }> {
    try {
      const [repoResponse, releasesResponse] = await Promise.all([
        axios.get<GitHubRepo>(`${GITHUB_API}/repos/${repoPath}`),
        axios.get<GitHubRelease[]>(`${GITHUB_API}/repos/${repoPath}/releases`, {
          params: { per_page: 1 }
        })
      ])

      return {
        repo: repoResponse.data,
        latestRelease: releasesResponse.data.length > 0 ? releasesResponse.data[0] : null
      }
    } catch (error) {
      console.error(`获取GitHub仓库信息失败: ${repoPath}`, error)
      throw error
    }
  }

  static async getDockerHubTags(repoPath: string): Promise<DockerHubTag[]> {
    try {
      const response = await axios.get<{ results: DockerHubTag[] }>(`${DOCKER_HUB_API}/${repoPath}/tags`, {
        params: { page_size: 10 }
      })
      return response.data.results
    } catch (error) {
      console.error(`获取Docker Hub标签失败: ${repoPath}`, error)
      throw error
    }
  }

  static async getGitHubPackages(repoPath: string): Promise<GitHubPackage[]> {
    try {
      // 尝试获取组织级别的packages
      const orgResponse = await axios.get<{ packages: GitHubPackage[] }>(`${GITHUB_API}/orgs/${repoPath.split('/')[0]}/packages`, {
        params: { 
          package_type: 'container',
          per_page: 50
        }
      })
      
      // 过滤出属于当前仓库的packages
      const repoName = repoPath.split('/')[1]
      const filteredPackages = orgResponse.data.packages.filter(pkg => 
        pkg.name.toLowerCase().includes(repoName.toLowerCase()) || 
        pkg.name.includes(repoName)
      )
      
      // 如果组织级别没有找到，尝试用户级别的packages
      if (filteredPackages.length === 0) {
        try {
          const userResponse = await axios.get<{ packages: GitHubPackage[] }>(`${GITHUB_API}/users/${repoPath.split('/')[0]}/packages`, {
            params: { 
              package_type: 'container',
              per_page: 50
            }
          })
          
          return userResponse.data.packages.filter(pkg => 
            pkg.name.toLowerCase().includes(repoName.toLowerCase()) || 
            pkg.name.includes(repoName)
          )
        } catch (userError) {
          // 用户级别也失败，返回空数组
          return []
        }
      }
      
      return filteredPackages
    } catch (error) {
      console.error(`获取GitHub Packages失败: ${repoPath}`, error)
      return [] // 返回空数组而不是抛出错误
    }
  }

  static parseSiteUrl(url: string): { type: string; path: string } {
    if (url.includes('github.com')) {
      if (url.includes('/pkgs/container/')) {
        return {
          type: 'github-docker',
          path: url.replace('https://github.com/', '').split('/pkgs/container/')[0]
        }
      } else {
        return {
          type: 'github-repo',
          path: url.replace('https://github.com/', '').replace('/tags', '')
        }
      }
    } else if (url.includes('hub.docker.com')) {
      const match = url.match(/hub\.docker\.com\/r\/([^\/]+)\/([^\/]+)/)
      if (match) {
        return {
          type: 'docker-hub',
          path: `${match[1]}/${match[2]}`
        }
      }
    }
    
    throw new Error(`不支持的URL格式: ${url}`)
  }

  static async getSiteStatus(name: string, url: string, desc?: string): Promise<SiteStatus> {
    try {
      const { type, path } = this.parseSiteUrl(url)
      
      switch (type) {
        case 'github-repo': {
          const { repo, latestRelease } = await this.getGitHubRepoInfo(path)
          const packages = await this.getGitHubPackages(path)
          const latestPackage = packages.length > 0 ? packages[0] : null
          
          return {
            name,
            url,
            desc,
            type: 'GitHub仓库',
            lastCommitTime: repo.pushed_at,
            latestVersion: latestRelease?.tag_name,
            lastUpdateTime: latestRelease?.published_at || repo.updated_at,
            packageVersion: latestPackage?.latest_version || undefined,
            packageUpdateTime: latestPackage?.updated_at || undefined,
            status: 'success'
          }
        }
        
        case 'github-docker': {
          const { repo, latestRelease } = await this.getGitHubRepoInfo(path)
          return {
            name,
            url,
            desc,
            type: 'GitHub Docker镜像',
            latestVersion: latestRelease?.tag_name,
            lastUpdateTime: latestRelease?.published_at || repo.updated_at,
            status: 'success'
          }
        }
        
        case 'docker-hub': {
          const tags = await this.getDockerHubTags(path)
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

  static async getAllSitesStatus(sites: { name: string; url: string; desc?: string }[]): Promise<SiteStatus[]> {
    const promises = sites.map(site => 
      this.getSiteStatus(site.name, site.url, site.desc)
    )
    
    return Promise.all(promises)
  }
}