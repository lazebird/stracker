/**
 * 根据仓库名生成可能的 GitHub Container Registry 包名列表
 * 用于多策略尝试查找匹配的 container package
 */
export function generatePackageNames(repoName: string): string[] {
  const lower = repoName.toLowerCase()
  const names = [
    lower,
    lower.replace(/-/g, ''),
    lower.replace(/_/g, ''),
    lower.replace(/[^a-z0-9]/g, ''),
    lower.split('-')[0],
    lower.replace(/-(tv|app|image|container|docker)$/i, ''),
  ]
  return [...new Set(names)]
}
