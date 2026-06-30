import axios from 'axios'
import type { SiteStatus, GitHubRepo, GitHubRelease, DockerHubTag, GitHubPackage } from '@/types'

const GITHUB_API = 'https://api.github.com'
const DOCKER_HUB_API = 'https://hub.docker.com/v2/repositories'

// 创建axios实例，配置GitHub token
const githubApi = axios.create({
  baseURL: GITHUB_API,
  headers: {
    'Accept': 'application/vnd.github.v3+json',
    ...(process.env.GITHUB_TOKEN && { 'Authorization': `token ${process.env.GITHUB_TOKEN}` })
  }
})

// 创建一个没有token的axios实例用于公开API访问
const githubPublicApi = axios.create({
  baseURL: GITHUB_API,
  headers: {
    'Accept': 'application/vnd.github.v3+json'
  }
})

export class ApiService {
  static async getGitHubRepoInfo(repoPath: string): Promise<{ repo: GitHubRepo; latestRelease: GitHubRelease | null; packages?: string[] }> {
    // 优先使用网页抓取，确保与日常所见一致，避免API限速
    try {
      console.log(`🌐 优先使用网页抓取获取仓库信息: ${repoPath}`)
      const webData = await this.getGitHubRepoInfoWeb(repoPath)
      console.log(`✅ 网页抓取成功获取仓库信息: ${repoPath}`)
      
      // 转换为标准格式
      const repo: GitHubRepo = {
        name: webData.name,
        full_name: webData.full_name,
        html_url: webData.html_url,
        pushed_at: webData.pushed_at,
        updated_at: webData.updated_at,
        default_branch: webData.default_branch
      }
      
      // 创建虚拟的release对象
      // published_at 优先使用页面提取的更新时间（可能是release发布日期），回退到commit时间
      const latestRelease: GitHubRelease | null = webData.latest_version ? {
        tag_name: webData.latest_version,
        published_at: webData.updated_at || webData.pushed_at,
        name: webData.latest_version
      } : null
      
      // 返回packages信息（如果存在）
      const result: any = {
        repo,
        latestRelease
      }
      if (webData.packages && webData.packages.length > 0) {
        result.packages = webData.packages
      }
      return result
    } catch (webError) {
      console.log(`⚠️  网页抓取失败，尝试GitHub API: ${repoPath}`)
      
      // 网页抓取失败，尝试API（带token）
      try {
        const [repoResponse, releasesResponse] = await Promise.all([
          githubApi.get<GitHubRepo>(`/repos/${repoPath}`),
          githubApi.get<GitHubRelease[]>(`/repos/${repoPath}/releases`, {
            params: { per_page: 1 }
          })
        ])

        const repo = repoResponse.data
        const latestRelease = releasesResponse.data.length > 0 ? releasesResponse.data[0] : null
        
        console.log(`✅ GitHub API成功获取仓库信息: ${repoPath}`)
        return {
          repo,
          latestRelease
        }
      } catch (error) {
        console.log(`⚠️  GitHub API失败，尝试公开API: ${repoPath}`)
        
        // API失败，尝试公开API
        try {
          const [publicRepoResponse, publicReleasesResponse] = await Promise.all([
            githubPublicApi.get<GitHubRepo>(`/repos/${repoPath}`),
            githubPublicApi.get<GitHubRelease[]>(`/repos/${repoPath}/releases`, {
              params: { per_page: 1 }
            })
          ])

          const repo = publicRepoResponse.data
          const latestRelease = publicReleasesResponse.data.length > 0 ? publicReleasesResponse.data[0] : null
          
          console.log(`✅ 公开API成功获取仓库信息: ${repoPath}`)
          return {
            repo,
            latestRelease
          }
        } catch (publicError) {
          console.error(`❌ 所有方法都失败: ${repoPath}`, publicError)
          throw new Error(`无法获取仓库信息: ${repoPath}`)
        }
      }
    }
  }

  // 网页抓取GitHub仓库信息
  static async getGitHubRepoInfoWeb(repoPath: string): Promise<any> {
    try {
      const response = await axios.get(`https://github.com/${repoPath}`, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      })
      
      const html = response.data
      const repoData = this.parseGitHubRepoPage(html)
      
      // 从主页面提取packages信息
      const packages = await this.extractPackagesFromRepoPage(html, repoPath)
      if (packages.length > 0) {
        console.log(`✅ 从主页面提取到 ${packages.length} 个packages:`, packages)
        repoData.packages = packages
      } else {
        console.log(`❌ 从主页面未提取到packages`)
      }
      
      // 总是从提交历史页面获取最新的提交时间（确保准确性，覆盖主页面可能的旧数据）
      const defaultBranch = repoData.default_branch || 'main'
      console.log(`🔄 从提交历史页面获取最新的提交时间: ${repoPath} (分支: ${defaultBranch})`)
      try {
        const commitsResponse = await axios.get(`https://github.com/${repoPath}/commits/${defaultBranch}/`, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        })
        
        const commitsHtml = commitsResponse.data
        
        // 从提交历史页面提取committedDate（第一个是最新的提交）
        const committedDateRegex = /"committedDate":"([^"]+)"/g
        const committedDateMatches = [...commitsHtml.matchAll(committedDateRegex)]
        
        if (committedDateMatches.length > 0) {
          const latestCommitDate = committedDateMatches[0][1]
          console.log(`✅ 从提交历史页面获取到最新提交时间: ${latestCommitDate}`)
          
          // 使用提交历史页面的最新时间（覆盖主页面可能过期的信息）
          repoData.pushed_at = latestCommitDate
          if (!repoData.updated_at) {
            repoData.updated_at = latestCommitDate
          }
        } else {
          console.log(`❌ 提交历史页面未找到时间信息，使用主页面时间`)
        }
      } catch (commitsError: any) {
        console.log(`❌ 获取提交历史页面失败: ${commitsError.message}，使用主页面时间`)
      }
      
      return repoData
    } catch (error) {
      console.error(`网页抓取GitHub仓库信息失败: ${repoPath}`, error)
      throw error
    }
  }

  // 从GitHub仓库主页面提取packages信息
  static async extractPackagesFromRepoPage(html: string, repoPath: string): Promise<string[]> {
    try {
      const packages: string[] = []
      const [, repo] = repoPath.split('/')
      
      // 方法1: 直接请求packages_list接口
      const packagesListMatch = html.match(/src="\/([^\/]+\/[^\/]+)\/packages_list[^"]*"/)
      if (packagesListMatch) {
        const packagesListUrl = `https://github.com/${packagesListMatch[1]}/packages_list?current_repository=${repo}`
        console.log(`🎯 找到packages_list接口: ${packagesListUrl}`)
        
        try {
          const packagesResponse = await axios.get(packagesListUrl, {
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          })
          
          const packagesHtml = packagesResponse.data
          
          // 从packages_list页面提取package链接
          const packageLinkRegex = /\/users\/[^\/]+\/packages\/container\/package\/([^"\s\/]+)/g
          const packageMatches = [...packagesHtml.matchAll(packageLinkRegex)]
          
          for (const match of packageMatches) {
            const packageName = match[1]
            if (packageName && !packages.includes(packageName)) {
              packages.push(packageName)
              console.log(`🎯 从packages_list找到package: ${packageName}`)
            }
          }
          
          if (packages.length > 0) {
            console.log(`✅ 从packages_list接口成功提取 ${packages.length} 个packages`)
            return packages
          }
        } catch (error: any) {
          console.log(`❌ 请求packages_list接口失败: ${error.message}`)
        }
      }
      
      // 方法2: 从页面中的packages链接提取（备用方法）
      const packageLinkRegex = /\/users\/[^\/]+\/packages\/container\/package\/([^"\s\/]+)/g
      const packageMatches = [...html.matchAll(packageLinkRegex)]
      
      for (const match of packageMatches) {
        const packageName = match[1]
        if (packageName && !packages.includes(packageName)) {
          packages.push(packageName)
          console.log(`🎯 从页面找到package: ${packageName}`)
        }
      }
      
      // 方法3: 从repo_packages_count meta标签中提取数量
      const packagesCountRegex = /<meta name="octolytics-dimension-repo_packages_count" content="(\d+)"/g
      const countMatches = [...html.matchAll(packagesCountRegex)]
      if (countMatches.length > 0) {
        const count = parseInt(countMatches[0][1])
        console.log(`📦 页面显示有 ${count} 个packages`)
      }
      
      // 方法4: 从packages标签页链接中提取
      if (packages.length === 0) {
        const packagesTabRegex = /href="\/([^\/]+\/[^\/]+)\/pkgs\/container\/([^"\s\/]+)"/g
        const packagesTabMatches = [...html.matchAll(packagesTabRegex)]
        
        for (const match of packagesTabMatches) {
          const packageName = match[2]
          if (packageName && !packages.includes(packageName)) {
            packages.push(packageName)
            console.log(`🎯 从packages标签页链接找到package: ${packageName}`)
          }
        }
      }
      
      // 方法5: 从GitHub Container Registry链接中提取
      if (packages.length === 0) {
        const containerLinkRegex = /pkgs\.container\.dev\/ghcr\.io\/[^\/]+\/([^"\s\/]+)/g
        const containerMatches = [...html.matchAll(containerLinkRegex)]
        
        for (const match of containerMatches) {
          const packageName = match[1]
          if (packageName && !packages.includes(packageName)) {
            packages.push(packageName)
            console.log(`🎯 从Container Registry链接找到package: ${packageName}`)
          }
        }
      }
      
      // 方法6: 从README或页面文本中提取可能的package名称（基于仓库名变体）
      if (packages.length === 0) {
        const repoLower = repo.toLowerCase()
        const possiblePackageNames = [
          repoLower,
          repoLower.replace(/-/g, ''),
          repoLower.replace(/_/g, ''),
          repoLower.replace(/[^a-z0-9]/g, ''),
          repoLower.split('-')[0],
          repoLower.replace(/-(tv|app|image|container|docker)$/i, '')
        ].filter((name, index, arr) => arr.indexOf(name) === index)
        
        // 检查页面中是否包含这些可能的package名称
        for (const pkgName of possiblePackageNames) {
          if (html.includes(pkgName) && !packages.includes(pkgName)) {
            packages.push(pkgName)
            console.log(`🎯 从页面文本推断package: ${pkgName}`)
          }
        }
      }
      
      return packages
    } catch (error) {
      console.error('从主页面提取packages信息失败:', error)
      return []
    }
  }

  static extractDefaultBranch(html: string): string {
    // 策略1: 从branch-select-menu或branch按钮中提取
    const branchRegex1 = /data-default-branch="([^"]+)"/
    const branchMatch1 = html.match(branchRegex1)
    if (branchMatch1) {
      return branchMatch1[1]
    }
    // 策略2: 从GitHub的JS初始化数据中提取 defaultBranch（最可靠，不会误配标签名）
    const branchRegex2 = /"defaultBranch":"([^"]+)"/
    const branchMatch2 = html.match(branchRegex2)
    if (branchMatch2) {
      return branchMatch2[1]
    }
    // 策略3: 从/tree/链接中推断默认分支名
    const branchRegex3 = /\/tree\/([^\/"']+)/
    const branchMatch3 = html.match(branchRegex3)
    if (branchMatch3 && !branchMatch3[1].includes('/')) {
      return branchMatch3[1]
    }
    // 策略4: 从分支选择器span中提取（最后备选，因为可能误配到标签元素的css-truncate-target）
    const branchRegex4 = /<span[^>]*class="[^"]*css-truncate-target[^"]*"[^>]*>([^<]+)<\/span>/
    const branchMatch4 = html.match(branchRegex4)
    if (branchMatch4) {
      return branchMatch4[1].trim()
    }
    // 回退: 检测常见分支名
    if (html.includes('/tree/master')) return 'master'
    return 'main'
  }

  // 解析GitHub仓库页面
  static parseGitHubRepoPage(html: string): any {
    const getMetaContent = (name: string): string | null => {
      const regex = new RegExp(`<meta name="${name}" content="([^"]*)"`)
      const match = html.match(regex)
      return match ? match[1] : null
    }

    const repoName = getMetaContent('octolytics-dimension-repo_nwo') || ''
    const defaultBranch = this.extractDefaultBranch(html)
    
    // 查找最新提交时间 - 尝试多种策略
    let lastCommitTime: string | null = null
    let committedDateMatches: RegExpMatchArray[] = [] // 提前定义，供后续使用
    
    // 策略1: 从JSON数据中提取committedDate（适用于提交历史页面，最准确）
    // 注意: committedDate 只出现在仓库页面的JSON-LD或commit列表数据中
    const committedDateRegex = /"committedDate":"([^"]+)"/g
    committedDateMatches = [...html.matchAll(committedDateRegex)]
    if (committedDateMatches.length > 0) {
      // 使用第一个committedDate（最新的提交）
      lastCommitTime = committedDateMatches[0][1]
      console.log(`🎯 从committedDate找到提交时间: ${lastCommitTime}`)
    }
    
    // 策略2: 从relative-time标签中提取（备用）
    // 注意: GitHub页面中第一个relative-time通常是最新提交的推送时间
    if (!lastCommitTime) {
      const commitTimeRegex = /relative-time[^>]*datetime="([^"]*)"/g
      const commitMatches = [...html.matchAll(commitTimeRegex)]
      if (commitMatches.length > 0) {
        // 使用第一个找到的时间作为提交时间
        lastCommitTime = commitMatches[0][1]
        console.log(`🎯 从relative-time找到提交时间: ${lastCommitTime}`)
      }
    }
    
    // 策略3: 从meta标签中提取（GitHub有时会在这里存储时间）
    if (!lastCommitTime) {
      const metaTime = getMetaContent('octolytics-dimension-repository_last_pushed')
      if (metaTime) {
        lastCommitTime = new Date(parseInt(metaTime) * 1000).toISOString()
        console.log(`🎯 从meta标签找到提交时间: ${lastCommitTime}`)
      }
    }
    
    // 策略4: 从页面任何datetime属性中提取第一个日期作为最终回退
    if (!lastCommitTime) {
      const anyDateTimeRegex = /datetime="(\d{4}-\d{2}-\d{2}T[^"]*)"/g
      const anyDateTimeMatches = [...html.matchAll(anyDateTimeRegex)]
      if (anyDateTimeMatches.length > 0) {
        lastCommitTime = anyDateTimeMatches[0][1]
        console.log(`🎯 从任意datetime属性找到提交时间: ${lastCommitTime}`)
      }
    }

    // 查找最新版本
    let latestVersion: string | null = null
    const releaseRegex = /href="\/[^\/]+\/[^\/]+\/releases\/tag\/([^"]+)"/
    const releaseMatch = html.match(releaseRegex)
    if (releaseMatch) {
      latestVersion = releaseMatch[1]
    }

    // 查找更新时间 - 尝试多种策略
    let lastUpdateTime: string | null = null
    
    // 策略1: 从relative-time标签中提取（使用第二个或更后面的时间）
    const commitTimeRegex = /relative-time[^>]*datetime="([^"]*)"/g
    const commitMatches = [...html.matchAll(commitTimeRegex)]
    if (commitMatches.length > 1) {
      lastUpdateTime = commitMatches[commitMatches.length - 1][1]
      console.log(`🎯 从relative-time找到更新时间: ${lastUpdateTime}`)
    } else if (commitMatches.length === 1) {
      // 如果只有一个时间，用它作为更新时间
      lastUpdateTime = commitMatches[0][1]
    }
    
    // 策略2: 从页面其他位置查找时间信息
    if (!lastUpdateTime) {
      // 查找类似 "datetime="2025-12-01" 的模式
      const dateTimeRegex = /datetime="(\d{4}-\d{2}-\d{2}[^"]*)"/g
      const dateTimeMatches = [...html.matchAll(dateTimeRegex)]
      if (dateTimeMatches.length > 0) {
        lastUpdateTime = dateTimeMatches[0][1]
        console.log(`🎯 从datetime属性找到时间: ${lastUpdateTime}`)
      }
    }
    
    // 策略3: 从JSON数据中提取committedDate作为更新时间
    if (!lastUpdateTime && committedDateMatches.length > 0) {
      // 使用最后一个committedDate作为更新时间
      lastUpdateTime = committedDateMatches[committedDateMatches.length - 1][1]
      console.log(`🎯 从committedDate找到更新时间: ${lastUpdateTime}`)
    }

    console.log(`📝 解析仓库信息 - 提交时间: ${lastCommitTime}, 更新时间: ${lastUpdateTime}, 版本: ${latestVersion}`)

    return {
      name: repoName.split('/')[1] || '',
      full_name: repoName,
      html_url: `https://github.com/${repoName}`,
      pushed_at: lastCommitTime,
      updated_at: lastUpdateTime,
      latest_version: latestVersion,
      default_branch: defaultBranch
    }
  }

  // 网页抓取GitHub packages信息
  static async getGitHubPackagesWeb(repoPath: string): Promise<GitHubPackage[]> {
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
          console.log(`🔍 尝试网页访问package: ${owner}/${repo}/pkgs/container/${packageName}`)
          const response = await axios.get(`https://github.com/${owner}/${repo}/pkgs/container/${packageName}`, {
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          })
          
          if (response.status === 200) {
            const html = response.data
            console.log(`🔍 解析package页面: ${packageName}, 页面长度: ${html.length}`)
            const packageData = this.parseGitHubPackagePage(html, repoPath)
            if (packageData) {
              console.log(`✅ 网页访问成功获取package: ${packageName}, 版本: ${packageData.latest_version}`)
              return [packageData]
            } else {
              console.log(`❌ 解析package页面失败: ${packageName}`)
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
  static parseGitHubPackagePage(html: string, repoPath: string): GitHubPackage | null {
    console.log('🔧 开始解析GitHub Package页面...')
    try {
      // 查找package名称 - 尝试多种策略
      let name: string | null = null
      
      // 策略1: 从页面标题中提取
      const titleRegex = /<title>Package\s+([^\s·]+)\s+·/
      const titleMatch = html.match(titleRegex)
      if (titleMatch) {
        name = titleMatch[1].trim()
        console.log(`🎯 从页面标题找到package名称: ${name}`)
      }
      
      // 策略2: 从h1标签中提取
      if (!name) {
        const nameRegex = /<h1[^>]*class="[^"]*f3[^"]*"[^>]*>([^<]+)</
        const nameMatch = html.match(nameRegex)
        if (nameMatch) {
          name = nameMatch[1].trim()
          console.log(`🎯 从h1标签找到package名称: ${name}`)
        }
      }
      
      // 策略3: 从docker pull命令中提取
      if (!name) {
        const dockerNameRegex = /docker pull ghcr\.io\/[^\/]+\/([^:]+):/
        const dockerNameMatch = html.match(dockerNameRegex)
        if (dockerNameMatch) {
          name = dockerNameMatch[1].trim()
          console.log(`🎯 从docker pull命令找到package名称: ${name}`)
        }
      }
      
      // 策略4: 从URL路径中提取
      if (!name && repoPath) {
        const repo = repoPath.split('/')[1]
        name = repo.toLowerCase()
        console.log(`🎯 从仓库路径提取package名称: ${name}`)
      }

      // 查找最新版本 - 尝试多种策略（增强版）
      let latestVersion: string | null = null
      
      // 策略1: 从docker pull命令中提取版本（增强）
      const dockerPullRegex = /docker pull ghcr\.io\/[^\/]+\/[^:]+:([^\s\"@]+)/
      const dockerPullMatch = html.match(dockerPullRegex)
      if (dockerPullMatch) {
        latestVersion = dockerPullMatch[1]
        console.log(`🎯 docker pull模式找到版本: ${latestVersion}`)
      }
      
      // 策略2: 从版本链接中提取（增强）
      if (!latestVersion) {
        const versionRegex = /href="\/[^\/]+\/pkgs\/container\/[^\/]+\/(\d+[^"]*)"/g
        const versionMatches = [...html.matchAll(versionRegex)]
        if (versionMatches.length > 0) {
          latestVersion = versionMatches[0][1]
          console.log(`🎯 版本链接模式找到版本: ${latestVersion} (共找到 ${versionMatches.length} 个版本链接)`)
        }
      }
      
      // 策略3: 从版本文本中提取（增强）
      if (!latestVersion) {
        const versionTextRegex = /\b(v?\d+\.\d+\.\d+[a-zA-Z0-9\-\.]*)\b/g
        const versionMatches = [...html.matchAll(versionTextRegex)]
        if (versionMatches.length > 0) {
          latestVersion = versionMatches[0][1]
          console.log(`🎯 版本文本模式找到版本: ${latestVersion} (共找到 ${versionMatches.length} 个版本)`)
        }
      }
      
      // 策略4: 从GitHub Container Registry URL中提取
      if (!latestVersion) {
        const containerUrlRegex = /ghcr\.io\/[^\/]+\/[^:]+:([^\s\"@]+)/g
        const containerMatches = [...html.matchAll(containerUrlRegex)]
        if (containerMatches.length > 0) {
          latestVersion = containerMatches[0][1]
          console.log(`🎯 Container URL模式找到版本: ${latestVersion}`)
        }
      }
      
      // 策略5: 从页面标题或h2/h3中提取版本信息
      if (!latestVersion) {
        const headingVersionRegex = /<(h2|h3|div)[^>]*>\s*(v?\d+\.\d+\.\d+[a-zA-Z0-9\-\.]*)\s*<\/(h2|h3|div)>/i
        const headingMatch = html.match(headingVersionRegex)
        if (headingMatch) {
          latestVersion = headingMatch[2]
          console.log(`🎯 页面标题模式找到版本: ${latestVersion}`)
        }
      }

      // 查找更新时间 - 尝试多种策略
      let updateTime: string | null = null
      
      // 策略1: 从h3 title属性中提取（GitHub Container页面）
      const h3TimeRegex = /<h3[^>]*title="([^"]+)"[^>]*>\d+\s+(hour|day|month|minute|week|year)s?\s+ago<\/h3>/
      const h3TimeMatch = html.match(h3TimeRegex)
      if (h3TimeMatch) {
        updateTime = h3TimeMatch[1]
        console.log(`🎯 h3 title模式找到时间: ${updateTime}`)
      }
      
      // 策略2: 从relative-time标签中提取
      if (!updateTime) {
        const timeRegex = /relative-time[^>]*datetime="([^"]*)"/g
        const timeMatches = [...html.matchAll(timeRegex)]
        if (timeMatches.length > 0) {
          updateTime = timeMatches[0][1]
          console.log(`🎯 relative-time模式找到时间: ${updateTime} (共找到 ${timeMatches.length} 个时间标签)`)
        }
      }
      
      // 策略3: 从time标签中提取
      if (!updateTime) {
        const timeTagRegex = /<time[^>]*datetime="([^"]*)"/g
        const timeTagMatches = [...html.matchAll(timeTagRegex)]
        if (timeTagMatches.length > 0) {
          updateTime = timeTagMatches[0][1]
          console.log(`🎯 time标签模式找到时间: ${updateTime}`)
        }
      }

      console.log(`📝 解析得到的package名称: "${name}"`)
      console.log(`📝 解析得到的版本: "${latestVersion}"`)
      console.log(`📝 解析得到的时间: "${updateTime}"`)

      // 如果找到版本信息，则返回数据（即使没有名称）
      if (latestVersion) {
        return {
          name: name || 'unknown',
          latest_version: latestVersion,
          updated_at: updateTime,
          package_type: 'container',
          html_url: `https://github.com/packages/container/${name || 'unknown'}`,
          created_at: updateTime,
          id: 0,
          owner: { login: repoPath ? repoPath.split('/')[0] : '' }
        } as GitHubPackage
      } else if (name) {
        // 如果只有名称，返回基本信息
        console.log(`⚠️  未找到版本信息，仅返回package名称: ${name}`)
        return {
          name,
          latest_version: 'latest',
          updated_at: updateTime,
          package_type: 'container',
          html_url: `https://github.com/packages/container/${name}`,
          created_at: updateTime,
          id: 0,
          owner: { login: repoPath ? repoPath.split('/')[0] : '' }
        } as GitHubPackage
      }
    } catch (error) {
      console.error('解析GitHub Package页面失败:', error)
    }
    
    console.log('❌ 无法从页面中提取有效信息')
    return null
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

  static async getGitHubPackages(repoPath: string, knownPackages?: string[]): Promise<GitHubPackage[]> {
    try {
      const [owner, repo] = repoPath.split('/')
      const repoName = repo.toLowerCase()
      
      // 构建要尝试的package名称列表，优先使用已知的package名称
      const possibleNames: string[] = []
      
      // 如果提供了已知的package名称，优先尝试这些
      if (knownPackages && knownPackages.length > 0) {
        possibleNames.push(...knownPackages)
        console.log(`🎯 使用从主页面提取的packages: ${knownPackages.join(', ')}`)
      }
      
      // 添加基于仓库名的可能package名称
      possibleNames.push(
        repoName,
        repoName.replace(/tv$/i, 'tv'),
        repoName.replace(/-tv$/i, 'tv'),
        repoName.toLowerCase(),
        repoName.replace(/[^a-z0-9]/g, '').toLowerCase()
      )
      
      // 去重
      const uniqueNames = [...new Set(possibleNames)]
      
      for (const packageName of uniqueNames) {
        try {
          console.log(`尝试直接访问package: ${owner}/${packageName}`)
          const packageResponse = await githubApi.get<any>(`/orgs/${owner}/packages/container/${packageName}`)
          
          // 获取版本信息 - GitHub Package API不返回latest_version，需要额外调用versions接口
          try {
            const versionsResponse = await githubApi.get<any[]>(`/orgs/${owner}/packages/container/${packageName}/versions`, {
              params: { per_page: 1 }
            })
            
            if (versionsResponse.data.length > 0) {
              const versionData = versionsResponse.data[0]
              // 从metadata中提取版本标签
              const metadata = versionData.metadata || {}
              const container = metadata.container || {}
              const tags = container.tags || []
              
              if (tags.length > 0) {
                packageResponse.data.latest_version = tags[0]
                console.log(`✅ 成功获取package: ${packageName}, 版本: ${tags[0]}`)
              } else {
                packageResponse.data.latest_version = versionData.name || 'latest'
                console.log(`✅ 成功获取package: ${packageName}, 版本: ${packageResponse.data.latest_version}`)
              }
            }
          } catch (versionError) {
            console.log(`❌ 获取package版本信息失败: ${packageName}`)
            packageResponse.data.latest_version = 'latest'
          }
          
          return [packageResponse.data]
        } catch (packageError) {
          console.log(`❌ Package ${packageName} 不存在或无权限访问`)
          // 如果token访问失败，尝试公开API
          try {
            console.log(`🔄 尝试公开API访问package: ${owner}/${packageName}`)
            const publicResponse = await githubPublicApi.get<any>(`/orgs/${owner}/packages/container/${packageName}`)
            
            // 公开API也需要获取版本信息
            try {
              const versionsResponse = await githubPublicApi.get<any[]>(`/orgs/${owner}/packages/container/${packageName}/versions`, {
                params: { per_page: 1 }
              })
              
              if (versionsResponse.data.length > 0) {
                const versionData = versionsResponse.data[0]
                const metadata = versionData.metadata || {}
                const container = metadata.container || {}
                const tags = container.tags || []
                
                if (tags.length > 0) {
                  publicResponse.data.latest_version = tags[0]
                } else {
                  publicResponse.data.latest_version = versionData.name || 'latest'
                }
              }
            } catch (versionError) {
              publicResponse.data.latest_version = 'latest'
            }
            
            console.log(`✅ 公开API成功获取package: ${packageName}`)
            return [publicResponse.data]
          } catch (publicError) {
            console.log(`❌ 公开API也无法访问package: ${packageName}`)
          }
        }
      }
      
      // 如果直接访问失败，尝试列表方式
      console.log(`直接访问失败，尝试获取packages列表...`)
      let allPackages: GitHubPackage[] = []
      
      // 尝试获取组织级别的packages
      try {
        const orgResponse = await githubApi.get<{ packages: GitHubPackage[] }>(`/orgs/${owner}/packages`, {
          params: { 
            package_type: 'container',
            per_page: 50
          }
        })
        allPackages = allPackages.concat(orgResponse.data.packages)
      } catch (orgError) {
        console.log(`组织级别packages获取失败，尝试用户级别: ${owner}`)
      }
      
      // 如果组织级别没有获取到或失败，尝试用户级别的packages
      if (allPackages.length === 0) {
        try {
          const userResponse = await githubApi.get<{ packages: GitHubPackage[] }>(`/users/${owner}/packages`, {
            params: { 
              package_type: 'container',
              per_page: 50
            }
          })
          allPackages = allPackages.concat(userResponse.data.packages)
        } catch (userError) {
          console.log(`用户级别packages获取失败: ${owner}`)
        }
      }
      
      // 更精确的匹配逻辑
      const filteredPackages = allPackages.filter(pkg => {
        const packageName = pkg.name.toLowerCase()
        
        // 直接匹配仓库名
        if (packageName === repoName) return true
        
        // 包含仓库名
        if (packageName.includes(repoName) || repoName.includes(packageName)) return true
        
        // 去掉常见后缀后匹配
        const cleanRepoName = repoName.replace(/-(app|image|container|docker)$/i, '')
        const cleanPackageName = packageName.replace(/-(app|image|container|docker)$/i, '')
        if (cleanPackageName === cleanRepoName || cleanPackageName.includes(cleanRepoName) || cleanRepoName.includes(cleanPackageName)) {
          return true
        }
        
        return false
      })
      
      // 为匹配的packages获取版本信息
      for (const pkg of filteredPackages) {
        try {
          const versionsResponse = await githubApi.get<any[]>(`/orgs/${owner}/packages/container/${pkg.name}/versions`, {
            params: { per_page: 1 }
          })
          
          if (versionsResponse.data.length > 0) {
            const versionData = versionsResponse.data[0]
            const metadata = versionData.metadata || {}
            const container = metadata.container || {}
            const tags = container.tags || []
            
            if (tags.length > 0) {
              pkg.latest_version = tags[0]
            } else {
              pkg.latest_version = versionData.name || 'latest'
            }
          }
        } catch (versionError) {
          pkg.latest_version = 'latest'
        }
      }
      
      console.log(`Packages匹配结果 for ${repoPath}:`, {
        totalPackages: allPackages.length,
        matchedPackages: filteredPackages.length,
        matchedNames: filteredPackages.map(p => p.name)
      })
      
      // 如果所有方法都失败，尝试自动生成GitHub Container URL
      if (filteredPackages.length === 0) {
        console.log(`🔄 所有API方法失败，尝试自动生成GitHub Container URL访问: ${owner}/${repoName}`)
        
        // 生成可能的package名称变体
        const generatedNames = [
          repoName,                                    // 原始仓库名
          repoName.toLowerCase(),                      // 小写
          repoName.replace(/-/g, ''),                  // 去掉连字符
          repoName.replace(/_/g, ''),                  // 去掉下划线
          repoName.replace(/[^a-z0-9]/g, ''),          // 只保留字母数字
          repoName.split('-')[0],                      // 取第一部分
          repoName.replace(/-(tv|app|image|container|docker)$/i, ''), // 去掉常见后缀
        ].filter((name, index, arr) => arr.indexOf(name) === index) // 去重
        
        for (const generatedName of generatedNames) {
          try {
            console.log(`🔍 尝试自动生成的package名称: ${owner}/${generatedName}`)
            const packageResponse = await githubApi.get<GitHubPackage>(`/orgs/${owner}/packages/container/${generatedName}`)
            console.log(`✅ 自动生成成功获取package: ${generatedName}`)
            return [packageResponse.data]
          } catch (generatedError) {
            console.log(`❌ 自动生成的package ${generatedName} 不存在`)
            // 如果token访问失败，尝试公开API
            try {
              console.log(`🔄 尝试公开API访问自动生成的package: ${owner}/${generatedName}`)
              const publicResponse = await githubPublicApi.get<GitHubPackage>(`/orgs/${owner}/packages/container/${generatedName}`)
              console.log(`✅ 公开API成功获取自动生成的package: ${generatedName}`)
              return [publicResponse.data]
            } catch (publicError) {
              console.log(`❌ 公开API也无法访问自动生成的package: ${generatedName}`)
            }
          }
        }
        
        console.log(`🌐 所有API方法都失败，尝试网页抓取方式: ${owner}/${repoName}`)
        try {
          const webPackages = await this.getGitHubPackagesWeb(repoPath)
          console.log(`🔍 网页抓取返回结果: ${webPackages.length}个packages`)
          if (webPackages.length > 0) {
            console.log(`✅ 网页抓取成功获取packages: ${webPackages.length}个`)
            return webPackages
          } else {
            console.log(`❌ 网页抓取返回空结果`)
          }
        } catch (webError: any) {
          console.log(`❌ 网页抓取也无法获取packages: ${webError.message}`)
        }
        
        console.log(`🚫 所有方法都无法访问packages，返回空数组`)
      }
      
      return filteredPackages
    } catch (error) {
      console.error(`获取GitHub Packages失败: ${repoPath}`, error)
      return [] // 返回空数组而不是抛出错误
    }
  }

  static parseSiteUrl(url: string): { type: string; path: string; packagePath?: string } {
    if (url.includes('github.com')) {
      if (url.includes('/pkgs/container/')) {
        const urlParts = url.replace('https://github.com/', '').split('/pkgs/container/')
        return {
          type: 'github',
          path: urlParts[0],
          packagePath: urlParts[1]
        }
      } else {
        return {
          type: 'github',
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

  static async getSiteStatus(name: string, url: string, desc?: string, pkgname?: string): Promise<SiteStatus> {
    try {
      const { type, path } = this.parseSiteUrl(url)
      
      switch (type) {
        case 'github': {
          const { repo, latestRelease, packages: repoPackages } = await this.getGitHubRepoInfo(path)
          
          // 如果有指定的pkgname，直接使用它获取package信息
          let latestPackage: GitHubPackage | null = null
          if (pkgname) {
            try {
              console.log(`🔍 使用指定的pkgname获取package: ${pkgname}`)
              const packages = await this.getGitHubPackagesWeb(`${path.split('/')[0]}/${pkgname}`)
              if (packages.length > 0) {
                latestPackage = packages[0]
                console.log(`✅ 使用指定的pkgname成功获取package: ${pkgname}`)
              }
            } catch (error: any) {
              console.log(`❌ 使用指定的pkgname获取package失败: ${pkgname}`)
            }
          }
          
          // 如果指定pkgname失败或没有指定，尝试从repoPackages获取（从主页面提取的）
          if (!latestPackage && repoPackages && repoPackages.length > 0) {
            console.log(`🎯 使用从主页面提取的package: ${repoPackages[0]}`)
            const packages = await this.getGitHubPackagesWeb(`${path.split('/')[0]}/${repoPackages[0]}`)
            if (packages.length > 0) {
              latestPackage = packages[0]
              console.log(`✅ 使用从主页面提取的package成功: ${repoPackages[0]}`)
            }
          }
          
          // 如果主页面提取的package也失败，尝试常规方式（带上已知的package名称）
          if (!latestPackage) {
            const packages = await this.getGitHubPackages(path, repoPackages)
            latestPackage = packages.length > 0 ? packages[0] : null
          }
          
          // 如果网页抓取的版本号为undefined，尝试API方式重新获取（带上已知的package名称）
          if (latestPackage && !latestPackage.latest_version) {
            console.log(`⚠️  网页抓取的版本号为undefined，尝试API方式重新获取...`)
            const apiPackages = await this.getGitHubPackages(path, repoPackages)
            if (apiPackages.length > 0 && apiPackages[0].latest_version) {
              console.log(`✅ API方式成功获取版本号: ${apiPackages[0].latest_version}`)
              latestPackage = apiPackages[0]
            } else {
              console.log(`❌ API方式也无法获取版本号`)
            }
          }
          
          if (latestPackage) {
            console.log(`✅ 最终获取到package: ${latestPackage.name}, 版本: ${latestPackage.latest_version}`)
          } else {
            console.log(`❌ 未能获取到任何package信息`)
          }
          
          return {
            name,
            url,
            desc,
            type: 'GitHub网站',
            lastCommitTime: repo.pushed_at,
            latestVersion: latestRelease?.tag_name,
            // 只有存在latestRelease时才设置lastUpdateTime
            lastUpdateTime: latestRelease?.published_at || undefined,
            packageVersion: latestPackage?.latest_version, // 保持原始值，不敷衍
            packageUpdateTime: latestPackage?.updated_at || undefined,
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