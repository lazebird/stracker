import axios from 'axios'
import type { DockerHubTag } from '@/types'

const DOCKER_HUB_API = 'https://hub.docker.com/v2/repositories'

export async function getDockerHubTags(repoPath: string): Promise<DockerHubTag[]> {
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
