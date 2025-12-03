<template>
  <div class="site-tracker">
    <div class="actions">
      <button @click="refreshData" :disabled="loading" class="refresh-btn">
        {{ loading ? '刷新中...' : '刷新数据' }}
      </button>
      <span class="last-update" v-if="lastUpdateTime">
        最后更新: {{ formatTime(lastUpdateTime) }}
      </span>
    </div>

    <div v-if="loading && !sites.length" class="loading">
      正在加载网站数据...
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div v-else-if="sites.length" class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>网站名称</th>
            <th>描述</th>
            <th class="sortable" @click="toggleSort('codeUpdateTime')">
              代码更新时间
              <span v-if="sortField === 'codeUpdateTime'" class="sort-indicator">
                {{ sortOrder === 'asc' ? '↑' : '↓' }}
              </span>
            </th>
            <th>最新发布版本</th>
            <th class="sortable" @click="toggleSort('versionUpdateTime')">
              版本更新时间
              <span v-if="sortField === 'versionUpdateTime'" class="sort-indicator">
                {{ sortOrder === 'asc' ? '↑' : '↓' }}
              </span>
            </th>
            <th>Container版本</th>
            <th class="sortable" @click="toggleSort('containerUpdateTime')">
              Container更新时间
              <span v-if="sortField === 'containerUpdateTime'" class="sort-indicator">
                {{ sortOrder === 'asc' ? '↑' : '↓' }}
              </span>
            </th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="site in sortedSites" :key="site.name">
            <td>
              <a :href="site.url" target="_blank" class="site-link">
                {{ site.name }}
              </a>
            </td>
            <td>{{ site.desc || '-' }}</td>
            <td>{{ getCodeUpdateTime(site) }}</td>
            <td>{{ site.latestVersion || '-' }}</td>
            <td>{{ site.lastUpdateTime ? formatTime(site.lastUpdateTime) : '-' }}</td>
            <td>{{ getPackageVersion(site) }}</td>
            <td>{{ getPackageUpdateTime(site) }}</td>
            <td>
              <span :class="['status-badge', `status-${site.status}`]">
                {{ getStatusText(site.status) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="empty">
      暂无网站数据，请先运行数据获取脚本
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ApiService } from '@/services/api'
import type { SiteStatus } from '@/types'

const sites = ref<SiteStatus[]>([])
const loading = ref(false)
const error = ref('')
const lastUpdateTime = ref('')

// 排序状态
const sortField = ref<'codeUpdateTime' | 'versionUpdateTime' | 'containerUpdateTime' | null>(null)
const sortOrder = ref<'asc' | 'desc'>('desc')

const formatTime = (timeString: string): string => {
  try {
    return new Date(timeString).toLocaleString('zh-CN')
  } catch {
    return timeString
  }
}

const getStatusText = (status: string): string => {
  switch (status) {
    case 'success': return '正常'
    case 'error': return '错误'
    case 'loading': return '加载中'
    default: return status
  }
}

const getCodeUpdateTime = (site: any): string => {
  // Docker Hub镜像不显示代码更新时间
  if (site.type === 'Docker Hub镜像') {
    return '-'
  }
  // 其他类型显示代码更新时间或版本更新时间
  return site.lastCommitTime ? formatTime(site.lastCommitTime) : (site.lastUpdateTime ? formatTime(site.lastUpdateTime) : '-')
}

const getPackageVersion = (site: any): string => {
  // 只有GitHub仓库显示package版本
  if (site.type === 'GitHub仓库') {
    return site.packageVersion || '-'
  }
  return '-'
}

const getPackageUpdateTime = (site: any): string => {
  // 只有GitHub仓库显示package更新时间
  if (site.type === 'GitHub仓库') {
    return site.packageUpdateTime ? formatTime(site.packageUpdateTime) : '-'
  }
  return '-'
}

// 获取排序后的网站列表
const sortedSites = computed(() => {
  if (!sortField.value) return sites.value
  
  return [...sites.value].sort((a, b) => {
    let aValue: string | null = null
    let bValue: string | null = null
    
    switch (sortField.value) {
      case 'codeUpdateTime':
        aValue = a.type === 'Docker Hub镜像' ? null : (a.lastCommitTime || a.lastUpdateTime || null)
        bValue = b.type === 'Docker Hub镜像' ? null : (b.lastCommitTime || b.lastUpdateTime || null)
        break
      case 'versionUpdateTime':
        aValue = a.lastUpdateTime || null
        bValue = b.lastUpdateTime || null
        break
      case 'containerUpdateTime':
        aValue = a.type === 'GitHub仓库' ? (a.packageUpdateTime || null) : null
        bValue = b.type === 'GitHub仓库' ? (b.packageUpdateTime || null) : null
        break
    }
    
    // 处理null值，将null视为最小值
    if (aValue === null && bValue === null) return 0
    if (aValue === null) return 1
    if (bValue === null) return -1
    
    const comparison = new Date(aValue).getTime() - new Date(bValue).getTime()
    return sortOrder.value === 'asc' ? comparison : -comparison
  })
})

// 切换排序
const toggleSort = (field: 'codeUpdateTime' | 'versionUpdateTime' | 'containerUpdateTime') => {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortOrder.value = 'desc'
  }
}

const loadData = async () => {
  try {
    const response = await fetch('/site_sub/src/data/sites.json')
    if (!response.ok) {
      throw new Error('加载数据失败')
    }
    const data = await response.json()
    sites.value = data
    lastUpdateTime.value = new Date().toISOString()
  } catch (err) {
    error.value = '加载网站数据失败，请检查数据文件是否存在'
    console.error('加载数据失败:', err)
  }
}

const refreshData = async () => {
  loading.value = true
  error.value = ''
  
  try {
    // 这里应该调用后端API来刷新数据
    // 由于是静态页面，我们只能重新加载本地数据
    await loadData()
  } catch (err) {
    error.value = '刷新数据失败'
  } finally {
    loading.value = false
  }
}

const refreshSingleSite = async (site: SiteStatus) => {
  site.status = 'loading'
  
  try {
    const updatedSite = await ApiService.getSiteStatus(site.name, site.url)
    const index = sites.value.findIndex(s => s.name === site.name)
    if (index !== -1) {
      sites.value[index] = updatedSite
    }
  } catch (err) {
    site.status = 'error'
    site.errorMessage = err instanceof Error ? err.message : '刷新失败'
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.site-tracker {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.refresh-btn {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.refresh-btn:hover:not(:disabled) {
  background-color: #0056b3;
}

.refresh-btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.last-update {
  color: #666;
  font-size: 14px;
}

.table-container {
  overflow-x: auto;
}

.site-link {
  color: #007bff;
  text-decoration: none;
}

.site-link:hover {
  text-decoration: underline;
}

.mini-btn {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}

.mini-btn:hover:not(:disabled) {
  background-color: #218838;
}

.sortable {
  cursor: pointer;
  user-select: none;
  position: relative;
}

.sortable:hover {
  background-color: #f5f5f5;
}

.sort-indicator {
  margin-left: 5px;
  font-size: 12px;
  color: #666;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #666;
}
</style>