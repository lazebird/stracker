// 前端数据获取服务 - 使用网页抓取方式
interface SiteStatus {
  name: string
  url: string
  desc?: string
  type: string
  lastCommitTime?: string
  latestVersion?: string
  lastUpdateTime?: string
  packageVersion?: string
  packageUpdateTime?: string
  status: 'success' | 'error' | 'loading'
  errorMessage?: string
}

export class FrontendApiService {
  // Docker Hub API基础URL
  private static readonly DOCKER_HUB_API = 'https://hub.docker.com/v2/repositories'

  // 解析网站URL
  static parseSiteUrl(url: string): { type: string; path: string; packagePath?: string } {
    if (url.includes('github.com')) {
      if (url.includes('/pkgs/container/')) {
        const urlParts = url.replace('https://github.com/', '').split('/pkgs/container/')
        return {
          type: 'github-docker',
          path: urlParts[0],
          packagePath: urlParts[1]
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

  // 通过网页抓取获取GitHub仓库信息
  static async getGitHubRepoInfoWeb(repoPath: string): Promise<any> {
    try {
      const response = await fetch(`https://github.com/${repoPath}`, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const html = await response.text()
      
      // 解析HTML获取信息
      const data = this.parseGitHubRepoPage(html)
      return data
    } catch (error) {
      console.error(`网页抓取GitHub仓库信息失败: ${repoPath}`, error)
      throw error
    }
  }

  // 解析GitHub仓库页面
  static parseGitHubRepoPage(html: string): any {
    // 使用正则表达式解析页面内容
    const getMetaContent = (name: string): string | null => {
      const regex = new RegExp(`<meta name="${name}" content="([^"]*)"`)
      const match = html.match(regex)
      return match ? match[1] : null
    }

    // 尝试从页面中提取信息
    const repoName = getMetaContent('octolytics-dimension-repo_nwo') || ''
    
    // 查找最新提交时间
    let lastCommitTime: string | null = null
    const commitTimeRegex = /relative-time[^>]*datetime="([^"]*)"/
    const commitMatch = html.match(commitTimeRegex)
    if (commitMatch) {
      lastCommitTime = commitMatch[1]
    }

    // 查找最新版本 - 尝试多种模式
    let latestVersion: string | null = null
    
    // 模式1: releases链接
    const releaseRegex = /href="\/[^\/]+\/[^\/]+\/releases\/tag\/([^"]+)"/
    const releaseMatch = html.match(releaseRegex)
    if (releaseMatch) {
      latestVersion = releaseMatch[1]
    }
    
    // 模式2: tag名称
    if (!latestVersion) {
      const tagRegex = /<a[^>]*href="\/[^\/]+\/[^\/]+\/tree\/([^"]+)"[^>]*>[^<]*<\/a>/
      const tagMatch = html.match(tagRegex)
      if (tagMatch) {
        latestVersion = tagMatch[1]
      }
    }

    // 查找更新时间
    let lastUpdateTime: string | null = null
    const updateTimeRegex = /relative-time[^>]*datetime="([^"]*)"/
    const updateTimeMatch = updateTimeRegex.exec(html)
    if (updateTimeMatch) {
      lastUpdateTime = updateTimeMatch[1]
    }

    return {
      name: repoName.split('/')[1] || '',
      full_name: repoName,
      html_url: `https://github.com/${repoName}`,
      pushed_at: lastCommitTime,
      updated_at: lastUpdateTime,
      latest_version: latestVersion,
      default_branch: 'main'
    }
  }

  // 通过网页抓取获取GitHub packages信息
  static async getGitHubPackagesWeb(repoPath: string): Promise<any[]> {
    try {
      const [owner, repo] = repoPath.split('/')
      const repoName = repo.toLowerCase()
      
      // 生成可能的package名称
      const possibleNames = [
        repoName,
        repoName.replace(/-/g, ''),
        repoName.replace(/_/g, ''),
        repoName.replace(/[^a-z0-9]/g, ''),
        repoName.split('-')[0],
        repoName.replace(/-(tv|app|image|container|docker)$/i, '')
      ].filter((name, index, arr) => arr.indexOf(name) === index)

      for (const packageName of possibleNames) {
        try {
          console.log(`🔍 尝试网页访问package: ${owner}/${packageName}`)
          const response = await fetch(`https://github.com/${owner}/pkgs/container/${packageName}`, {
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          })
          
          if (response.ok) {
            const html = await response.text()
            const packageData = this.parseGitHubPackagePage(html)
            if (packageData) {
              console.log(`✅ 网页访问成功获取package: ${packageName}`)
              return [packageData]
            }
          }
        } catch (error) {
          console.log(`❌ 网页访问package失败: ${packageName}`)
        }
      }
      
      return []
    } catch (error) {
      console.error(`网页获取GitHub Packages失败: ${repoPath}`, error)
      return []
    }
  }

  // 解析GitHub Package页面
  static parseGitHubPackagePage(html: string): any | null {
    try {
      // 查找package名称
      const nameRegex = /<h1[^>]*class="[^"]*f3[^"]*"[^>]*>([^<]+)</
      const nameMatch = html.match(nameRegex)
      const name = nameMatch ? nameMatch[1].trim() : null

      // 查找最新版本 - 尝试多种模式
      let latestVersion: string | null = null
      
      // 模式1: 版本链接
      const versionRegex = /href="\/[^\/]+\/pkgs\/container\/[^\/]+\/(\d+[^"]*)"/
      const versionMatch = html.match(versionRegex)
      if (versionMatch) {
        latestVersion = versionMatch[1]
      }
      
      // 模式2: 版本号显示
      if (!latestVersion) {
        const versionTextRegex = /<[^>]*>(\d+\.\d+\.\d+[^<]*)</
        const versionTextMatch = html.match(versionTextRegex)
        if (versionTextMatch) {
          latestVersion = versionTextMatch[1]
        }
      }

      // 查找更新时间
      const timeRegex = /relative-time[^>]*datetime="([^"]*)"/
      const timeMatch = html.match(timeRegex)
      const updateTime = timeMatch ? timeMatch[1] : null

      if (name) {
        return {
          name,
          latest_version: latestVersion || 'latest',
          updated_at: updateTime,
          package_type: 'container'
        }
      }
    } catch (error) {
      console.error('解析GitHub Package页面失败:', error)
    }
    
    return null
  }

  // 获取Docker Hub标签（前端版本）
  static async getDockerHubTagsFrontend(repoPath: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.DOCKER_HUB_API}/${repoPath}/tags?page_size=1`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      return data.results || []
    } catch (error) {
      console.error(`获取Docker Hub标签失败: ${repoPath}`, error)
      return []
    }
  }

  // 获取单个网站状态（网页抓取版本）
  static async getSiteStatusFrontend(name: string, url: string, desc?: string): Promise<SiteStatus> {
    try {
      const { type, path } = this.parseSiteUrl(url)
      
      switch (type) {
        case 'github-repo': {
          const [repo, packages] = await Promise.all([
            this.getGitHubRepoInfoWeb(path),
            this.getGitHubPackagesWeb(path)
          ])
          
          const latestPackage = packages.length > 0 ? packages[0] : null
          
          return {
            name,
            url,
            desc,
            type: 'GitHub仓库',
            lastCommitTime: repo.pushed_at,
            latestVersion: repo.latest_version,
            lastUpdateTime: repo.updated_at,
            packageVersion: latestPackage?.latest_version || undefined,
            packageUpdateTime: latestPackage?.updated_at || undefined,
            status: 'success'
          }
        }
        
        case 'github-docker': {
          const [repo, packages] = await Promise.all([
            this.getGitHubRepoInfoWeb(path),
            this.getGitHubPackagesWeb(path)
          ])
          
          const latestPackage = packages.length > 0 ? packages[0] : null
          
          return {
            name,
            url,
            desc,
            type: 'GitHub Docker镜像',
            latestVersion: repo.latest_version,
            lastUpdateTime: repo.updated_at,
            packageVersion: latestPackage?.latest_version || undefined,
            packageUpdateTime: latestPackage?.updated_at || undefined,
            status: 'success'
          }
        }
        
        case 'docker-hub': {
          const tags = await this.getDockerHubTagsFrontend(path)
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

  // 刷新单个网站数据
  static async refreshSingleSite(site: SiteStatus): Promise<SiteStatus> {
    const updatedSite = await this.getSiteStatusFrontend(site.name, site.url, site.desc)
    return updatedSite
  }
}