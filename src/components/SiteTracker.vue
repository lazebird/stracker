<template>
  <div class="site-tracker">
    <div class="actions">
      <button @click="saveSnapshot" :disabled="loading" class="snapshot-btn">
        记录状态
      </button>
      <button v-if="hasSnapshot" @click="showSnapshotModal" class="view-snapshot-btn">
        查看记录
      </button>
      <span class="last-update" v-if="lastUpdateTime">
        最后更新: {{ formatTime(lastUpdateTime) }}
      </span>
    </div>

    <!-- 快照数据弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop :style="{ top: modalPosition.y + 'px', left: modalPosition.x + 'px' }">
        <div class="modal-header" @mousedown="startDrag">
          <h3>历史记录快照</h3>
          <button @click="closeModal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div v-if="snapshotData" class="snapshot-info">
            <p><strong>记录时间：</strong>{{ formatTime(snapshotData.timestamp) }}</p>
            <p><strong>记录站点数：</strong>{{ snapshotData.sites?.length || 0 }} 个</p>
          </div>
          <table v-if="snapshotData && snapshotData.sites" class="snapshot-table">
            <thead>
              <tr>
                <th>网站名称</th>
                <th>描述</th>
                <th>代码更新时间</th>
                <th>最新版本</th>
                <th>版本更新时间</th>
                <th>Container版本</th>
                <th>Container更新时间</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="site in (snapshotData.sites || [])" :key="site.name">
                <td>{{ site.name }}</td>
                <td>{{ site.desc || '-' }}</td>
                <td>{{ site.lastCommitTime ? formatTime(site.lastCommitTime) : '-' }}</td>
                <td>{{ site.latestVersion || '-' }}</td>
                <td>{{ site.lastUpdateTime ? formatTime(site.lastUpdateTime) : '-' }}</td>
                <td>{{ site.packageVersion || '-' }}</td>
                <td>{{ site.packageUpdateTime ? formatTime(site.packageUpdateTime) : '-' }}</td>
                <td>
                  <span :class="['status-badge', `status-${site.status}`]">
                    {{ getStatusText(site.status) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-snapshot">
            暂无历史记录
          </div>
        </div>
      </div>
    </div>

    <!-- 快照数据弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop :style="{ top: modalPosition.y + 'px', left: modalPosition.x + 'px' }">
        <div class="modal-header" @mousedown="startDrag">
          <h3>历史记录快照</h3>
          <button @click="closeModal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div v-if="snapshotData" class="snapshot-info">
            <p><strong>记录时间：</strong>{{ formatTime(snapshotData.timestamp) }}</p>
            <p><strong>记录站点数：</strong>{{ snapshotData.sites?.length || 0 }} 个</p>
          </div>
          <table v-if="snapshotData && snapshotData.sites" class="snapshot-table">
            <thead>
              <tr>
                <th>网站名称</th>
                <th>描述</th>
                <th>代码更新时间</th>
                <th>最新版本</th>
                <th>版本更新时间</th>
                <th>Container版本</th>
                <th>Container更新时间</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="site in (snapshotData.sites || [])" :key="site.name">
                <td>{{ site.name }}</td>
                <td>{{ site.desc || '-' }}</td>
                <td>{{ site.lastCommitTime ? formatTime(site.lastCommitTime) : '-' }}</td>
                <td>{{ site.latestVersion || '-' }}</td>
                <td>{{ site.lastUpdateTime ? formatTime(site.lastUpdateTime) : '-' }}</td>
                <td>{{ site.packageVersion || '-' }}</td>
                <td>{{ site.packageUpdateTime ? formatTime(site.packageUpdateTime) : '-' }}</td>
                <td>
                  <span :class="['status-badge', `status-${site.status}`]">
                    {{ getStatusText(site.status) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-snapshot">
            暂无历史记录
          </div>
        </div>
      </div>
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
          <tr v-for="site in sortedSites" :key="site.name" :class="{ 'row-highlight': site.hasChanges || site.isNew }">
            <td>
              <a :href="site.url" target="_blank" class="site-link">
                {{ site.name }}
              </a>
              <span v-if="site.isNew" class="badge-new">新</span>
              <span v-else-if="site.hasChanges" class="badge-updated">更新</span>
            </td>
            <td>{{ site.desc || '-' }}</td>
            <td>{{ getCodeUpdateTime(site) }}</td>
            <td>{{ getReleaseVersion(site) }}</td>
            <td>{{ getReleaseUpdateTime(site) }}</td>
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
import type { SiteStatus } from '@/types'

const sites = ref<SiteStatusWithSnapshot[]>([])
const loading = ref(false)
const error = ref('')
const lastUpdateTime = ref('')

// 弹窗状态
const showModal = ref(false)
const snapshotData = ref<{ timestamp: string; sites: SiteStatus[] } | null>(null)
const hasSnapshot = computed(() => !!localStorage.getItem('siteSnapshot'))

// 弹窗拖动相关
const isDragging = ref(false)
const modalPosition = ref({ x: 100, y: 100 })
const dragOffset = ref({ x: 0, y: 0 })

// 弹窗状态

// 扩展 SiteStatus 类型，添加快照对比字段
interface SiteStatusWithSnapshot extends SiteStatus {
  isNew?: boolean
  hasChanges?: boolean
}

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
  // GitHub网站显示代码更新时间或版本更新时间
  return site.lastCommitTime ? formatTime(site.lastCommitTime) : (site.lastUpdateTime ? formatTime(site.lastUpdateTime) : '-')
}

const getPackageVersion = (site: any): string => {
  // GitHub网站显示package版本，Docker Hub镜像显示latest版本
  if (site.type === 'GitHub网站') {
    return site.packageVersion || '-'
  } else if (site.type === 'Docker Hub镜像') {
    return site.latestVersion || '-'
  }
  return '-'
}

const getPackageUpdateTime = (site: any): string => {
  // GitHub网站显示package更新时间，Docker Hub镜像显示版本更新时间
  if (site.type === 'GitHub网站') {
    return site.packageUpdateTime ? formatTime(site.packageUpdateTime) : '-'
  } else if (site.type === 'Docker Hub镜像') {
    return site.lastUpdateTime ? formatTime(site.lastUpdateTime) : '-'
  }
  return '-'
}

const getReleaseVersion = (site: any): string => {
  // 只有GitHub网站显示release版本
  if (site.type === 'GitHub网站') {
    return site.latestVersion || '-'
  }
  return '-'
}

const getReleaseUpdateTime = (site: any): string => {
  // 只有GitHub网站显示release更新时间
  if (site.type === 'GitHub网站') {
    return site.lastUpdateTime ? formatTime(site.lastUpdateTime) : '-'
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
        aValue = a.type === 'GitHub网站' ? (a.packageUpdateTime || null) : null
        bValue = b.type === 'GitHub网站' ? (b.packageUpdateTime || null) : null
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
    const url = '/stracker/data/sites.json'
    console.log('正在请求数据文件:', url)
    const response = await fetch(url)
    console.log('响应状态:', response.status, response.statusText)
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`)
    }
    const contentType = response.headers.get('content-type')
    console.log('Content-Type:', contentType)
    const text = await response.text()
    console.log('原始响应内容:', text.substring(0, 200))
    const data = JSON.parse(text)
    console.log('数据加载成功:', data)
    
    // 读取metadata中的生成时间
    if (data.metadata && data.metadata.generatedAt) {
      lastUpdateTime.value = data.metadata.generatedAt
    } else {
      // 兼容旧数据格式
      lastUpdateTime.value = new Date().toISOString()
    }
    
    const sitesData = data.sites || data
    console.log('准备处理的站点数据:', sitesData)
    
    // 确保 sitesData 是数组
    if (!Array.isArray(sitesData)) {
      throw new Error('数据格式错误: sites 不是数组')
    }
    
    // 检查是否有历史快照
    const snapshot = loadSnapshot()
    if (snapshot && Array.isArray(snapshot.sites)) {
      console.log('发现历史快照:', new Date(snapshot.timestamp).toLocaleString('zh-CN'))
      sites.value = compareWithSnapshot(sitesData, snapshot.sites)
    } else {
      console.log('无历史快照，直接使用当前数据')
      sites.value = sitesData
    }
    console.log('数据加载完成，站点数量:', sites.value?.length || 0)
  } catch (err) {
    error.value = '加载网站数据失败，请检查数据文件是否存在'
    console.error('加载数据失败:', err)
    sites.value = [] // 确保 sites 是数组
  }
}

  const saveSnapshot = () => {
  try {
    const snapshot = {
      timestamp: new Date().toISOString(),
      sites: sites.value || []
    }
    localStorage.setItem('siteSnapshot', JSON.stringify(snapshot))
    alert('状态已保存到本地！')
  } catch (err) {
    console.error('保存状态失败:', err)
    alert('保存失败，请检查浏览器存储权限')
  }
}

const showSnapshotModal = () => {
  const saved = localStorage.getItem('siteSnapshot')
  if (saved) {
    snapshotData.value = JSON.parse(saved)
    showModal.value = true
  } else {
    alert('暂无历史记录')
  }
}

const closeModal = () => {
  showModal.value = false
}

const startDrag = (event: MouseEvent) => {
  isDragging.value = true
  const modalHeader = event.currentTarget as HTMLElement
  const modal = modalHeader.parentElement as HTMLElement
  
  dragOffset.value = {
    x: event.clientX - modal.offsetLeft,
    y: event.clientY - modal.offsetTop
  }
  
  dragOffset.value = {
    x: event.clientX - modal.offsetLeft,
    y: event.clientY - modal.offsetTop
  }
  
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

const onDrag = (event: MouseEvent) => {
  if (!isDragging.value) return
  
  modalPosition.value = {
    x: event.clientX - dragOffset.value.x,
    y: event.clientY - dragOffset.value.y
  }
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const loadSnapshot = (): { timestamp: string; sites: SiteStatusWithSnapshot[] } | null => {
  try {
    const saved = localStorage.getItem('siteSnapshot')
    if (!saved) return null
    const parsed = JSON.parse(saved)
    // 验证数据结构
    if (!parsed || !Array.isArray(parsed.sites)) {
      console.error('历史状态数据格式错误:', parsed)
      return null
    }
    return parsed
  } catch (err) {
    console.error('加载历史状态失败:', err)
    return null
  }
}

const compareWithSnapshot = (currentSites: SiteStatus[], snapshotSites: SiteStatusWithSnapshot[]) => {
  if (!Array.isArray(snapshotSites)) {
    console.error('compareWithSnapshot: snapshotSites 不是数组', snapshotSites)
    return currentSites.map(site => ({ ...site, isNew: true }))
  }
  
  const snapshotMap = new Map(snapshotSites.map(site => [site.name, site]))
  
  return currentSites.map(site => {
    const snapshot = snapshotMap.get(site.name)
    if (!snapshot) {
      return { ...site, isNew: true }
    }
    
    const hasChanges = 
      site.latestVersion !== snapshot.latestVersion ||
      site.packageVersion !== snapshot.packageVersion ||
      site.lastCommitTime !== snapshot.lastCommitTime ||
      site.packageUpdateTime !== snapshot.packageUpdateTime
    
    return { ...site, hasChanges }
  })
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

.snapshot-btn {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.snapshot-btn:hover:not(:disabled) {
  background-color: #218838;
}

.snapshot-btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.view-snapshot-btn {
  background-color: #17a2b8;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-left: 10px;
}

.view-snapshot-btn:hover {
  background-color: #138496;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 80%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  position: absolute;
  cursor: move;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  background-color: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.snapshot-info {
  margin-bottom: 20px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border-left: 4px solid #17a2b8;
}

.snapshot-info p {
  margin: 8px 0;
  color: #555;
}

.snapshot-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.snapshot-table th,
.snapshot-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.snapshot-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #333;
  position: sticky;
  top: 0;
}

.snapshot-table tr:hover {
  background-color: #f5f5f5;
}

.empty-snapshot {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 16px;
}

.view-snapshot-btn {
  background-color: #17a2b8;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-left: 10px;
}

.view-snapshot-btn:hover {
  background-color: #138496;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 80%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  position: absolute;
  cursor: move;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  background-color: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.snapshot-info {
  margin-bottom: 20px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border-left: 4px solid #17a2b8;
}

.snapshot-info p {
  margin: 8px 0;
  color: #555;
}

.snapshot-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.snapshot-table th,
.snapshot-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.snapshot-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #333;
  position: sticky;
  top: 0;
}

.snapshot-table tr:hover {
  background-color: #f5f5f5;
}

.empty-snapshot {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 16px;
}

.view-snapshot-btn {
  background-color: #6f42c1;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-left: 10px;
}

.view-snapshot-btn:hover {
  background-color: #5a378c;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 80%;
  max-width: 800px;
  max-height: 80%;
  display: flex;
  flex-direction: column;
  position: absolute;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  background-color: #007bff;
  color: white;
  padding: 15px 20px;
  border-radius: 8px 8px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  max-height: calc(80vh - 60px);
}

.snapshot-info {
  background-color: #f8f9fa;
  padding: 10px 15px;
  border-radius: 4px;
  margin-bottom: 15px;
  font-size: 14px;
}

.snapshot-info p {
  margin: 5px 0;
}

.snapshot-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.snapshot-table th,
.snapshot-table td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.snapshot-table th {
  background-color: #f8f9fa;
  font-weight: 600;
}

.snapshot-table tr:hover {
  background-color: #f5f5f5;
}

.empty-snapshot {
  text-align: center;
  padding: 40px;
  color: #666;
}

.row-new {
  background-color: #fff3cd !important;
  animation: highlight 2s ease-in-out;
}

.row-updated {
  background-color: #d4edda !important;
  animation: highlight 2s ease-in-out;
}

@keyframes highlight {
  0% { background-color: #ffeb3b; }
  100% { background-color: transparent; }
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

.row-highlight {
  animation: pulse 2s infinite;
}

.badge-new {
  background-color: #ffc107;
  color: #333;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  margin-left: 5px;
  font-weight: bold;
}

.badge-updated {
  background-color: #28a745;
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  margin-left: 5px;
  font-weight: bold;
}

@keyframes pulse {
  0% { background-color: rgba(255, 193, 7, 0.3); }
  50% { background-color: rgba(255, 193, 7, 0.1); }
  100% { background-color: rgba(255, 193, 7, 0.3); }
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