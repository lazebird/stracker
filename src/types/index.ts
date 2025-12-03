export interface Site {
  name: string
  url: string
  desc?: string
  type?: 'github-repo' | 'github-docker' | 'docker-hub'
}

export interface GitHubPackage {
  id: number
  name: string
  package_type: string
  latest_version: string
  updated_at: string
}

export interface SiteStatus {
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

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  pushed_at: string
  updated_at: string
}

export interface GitHubRelease {
  tag_name: string
  published_at: string
  name: string
}

export interface DockerHubTag {
  name: string
  last_updated: string
}