import axios from 'axios'
import type { GitHubPackage } from '@/types'
import { generatePackageNames } from '@/utils/package-names'
import { parseGitHubRepoPage, parseGitHubPackagePage, type ScrapedRepoData } from './github-parse'

export type { ScrapedRepoData }

const BROWSER_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

export async function scrapeRepoPage(repoPath: string): Promise<ScrapedRepoData> {
  const response = await axios.get(`https://github.com/${repoPath}`, {
    headers: { ...BROWSER_HEADERS }
  })

  const html = response.data
  const repoData = parseGitHubRepoPage(html)

  const packages = await extractPackagesFromRepoPage(html, repoPath)
  if (packages.length > 0) {
    repoData.packages = packages
  }

  const defaultBranch = repoData.default_branch || 'main'
  try {
    const commitsResponse = await axios.get(`https://github.com/${repoPath}/commits/${defaultBranch}/`, {
      headers: { ...BROWSER_HEADERS }
    })

    const commitsHtml = commitsResponse.data
    const committedDateRegex = /"committedDate":"([^"]+)"/g
    const committedDateMatches = [...commitsHtml.matchAll(committedDateRegex)]

    if (committedDateMatches.length > 0) {
      const latestCommitDate = committedDateMatches[0][1]
      repoData.pushed_at = latestCommitDate
      if (!repoData.updated_at) {
        repoData.updated_at = latestCommitDate
      }
    }
  } catch {
    // 提交页面获取失败，使用主页面时间
  }

  return repoData
}

export async function extractPackagesFromRepoPage(html: string, repoPath: string): Promise<string[]> {
  try {
    const packages: string[] = []
    const [, repo] = repoPath.split('/')

    const packagesListMatch = html.match(/src="\/([^\/]+\/[^\/]+)\/packages_list[^"]*"/)
    if (packagesListMatch) {
      const packagesListUrl = `https://github.com/${packagesListMatch[1]}/packages_list?current_repository=${repo}`
      try {
        const packagesResponse = await axios.get(packagesListUrl, {
          headers: { ...BROWSER_HEADERS }
        })
        const packagesHtml = packagesResponse.data
        const packageLinkRegex = /\/users\/[^\/]+\/packages\/container\/package\/([^"\s\/]+)/g
        const packageMatches = [...packagesHtml.matchAll(packageLinkRegex)]
        for (const match of packageMatches) {
          const packageName = match[1]
          if (packageName && !packages.includes(packageName)) {
            packages.push(packageName)
          }
        }

        if (packages.length > 0) {
          return packages
        }
      } catch {
        // packages_list接口失败，继续其他方法
      }
    }

    // 从HTML多个位置尝试提取包名
    if (packages.length === 0) {
      const packagePatterns: Array<{ regex: RegExp; extract: (m: RegExpExecArray) => string }> = [
        { regex: /\/users\/[^\/]+\/packages\/container\/package\/([^"\s\/]+)/g, extract: m => m[1] },
        { regex: /href="\/([^\/]+\/[^\/]+)\/pkgs\/container\/([^"\s\/]+)"/g, extract: m => m[2] },
        { regex: /pkgs\.container\.dev\/ghcr\.io\/[^\/]+\/([^"\s\/]+)/g, extract: m => m[1] },
      ]
      for (const { regex, extract } of packagePatterns) {
        const matches = [...html.matchAll(regex)]
        for (const m of matches) {
          const name = extract(m)
          if (name && !packages.includes(name)) packages.push(name)
        }
        if (packages.length > 0) break
      }
    }

    if (packages.length === 0) {
      const possiblePackageNames = generatePackageNames(repo)

      for (const pkgName of possiblePackageNames) {
        if (html.includes(pkgName) && !packages.includes(pkgName)) {
          packages.push(pkgName)
        }
      }
    }

    return packages
  } catch {
    return []
  }
}

export async function scrapeGitHubPackagesWeb(repoPath: string): Promise<GitHubPackage[]> {
  const [owner, repo] = repoPath.split('/')
  const possibleNames = generatePackageNames(repo)

  for (const packageName of possibleNames) {
    try {
      const response = await axios.get(`https://github.com/${owner}/${repo}/pkgs/container/${packageName}`, {
        headers: { ...BROWSER_HEADERS }
      })

      if (response.status === 200) {
        const html = response.data
        const packageData = parseGitHubPackagePage(html, repoPath)
        if (packageData) {
          return [packageData]
        }
      }
    } catch {
      // 继续尝试下一个名称
    }
  }

  return []
}
