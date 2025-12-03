import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { ApiService } from '../src/services/api'

interface Config {
  sites: Array<{
    name: string
    url: string
  }>
}

async function fetchSiteData() {
  try {
    const configPath = join(process.cwd(), 'config.json')
    const configContent = readFileSync(configPath, 'utf-8')
    const config: Config = JSON.parse(configContent)
    
    console.log('开始获取网站数据...')
    const siteStatuses = await ApiService.getAllSitesStatus(config.sites)
    
    const outputPath = join(process.cwd(), 'src/data/sites.json')
    writeFileSync(outputPath, JSON.stringify(siteStatuses, null, 2))
    
    console.log(`数据已保存到: ${outputPath}`)
    console.log(`成功获取 ${siteStatuses.length} 个网站的状态信息`)
    
    siteStatuses.forEach(site => {
      console.log(`- ${site.name}: ${site.status}`)
      if (site.errorMessage) {
        console.log(`  错误: ${site.errorMessage}`)
      }
    })
    
  } catch (error) {
    console.error('获取网站数据失败:', error)
    process.exit(1)
  }
}

fetchSiteData()