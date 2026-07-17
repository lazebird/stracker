export interface ParsedUrl {
  type: 'github' | 'docker-hub'
  path: string
}

export function parseSiteUrl(url: string): ParsedUrl {
  if (url.includes('github.com')) {
    if (url.includes('/pkgs/container/')) {
      const urlParts = url.replace('https://github.com/', '').split('/pkgs/container/')
      return {
        type: 'github',
        path: urlParts[0],
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
