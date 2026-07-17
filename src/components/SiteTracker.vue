<template>
  <div class="site-tracker">
    <div class="actions">
      <button @click="onSaveSnapshot" :disabled="loading" class="snapshot-btn">
        记录状态
      </button>
      <button v-if="hasSnapshot" @click="onShowSnapshotModal" class="view-snapshot-btn">
        查看记录
      </button>
      <span class="last-update" v-if="lastUpdateTime">
        最后更新: {{ formatTime(lastUpdateTime) }}
      </span>
    </div>

    <SnapshotModal
      :show="showModal"
      :data="snapshotData"
      :position-style="{ top: modalPosition.y + 'px', left: modalPosition.x + 'px' }"
      @close="closeModal"
      @start-drag="startDrag"
    />

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
            <td>{{ fmtCodeUpdateTime(site) }}</td>
            <td>{{ fmtReleaseVersion(site) }}</td>
            <td>{{ fmtReleaseUpdateTime(site) }}</td>
            <td>{{ fmtPackageVersion(site) }}</td>
            <td>{{ fmtPackageUpdateTime(site) }}</td>
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
import { ref, onMounted } from 'vue'
import type { SiteStatus } from '@/types'
import {
  formatTime, getStatusText,
  getCodeUpdateTime as fmtCodeUpdateTime,
  getReleaseVersion as fmtReleaseVersion,
  getReleaseUpdateTime as fmtReleaseUpdateTime,
  getPackageVersion as fmtPackageVersion,
  getPackageUpdateTime as fmtPackageUpdateTime
} from '@/utils/format'
import { useSnapshot } from '@/composables/useSnapshot'
import { compareWithSnapshot, type SiteStatusWithSnapshot } from '@/utils/snapshot-compare'
import { useSort } from '@/composables/useSort'
import SnapshotModal from './SnapshotModal.vue'

const sites = ref<SiteStatusWithSnapshot[]>([])
const loading = ref(false)
const error = ref('')
const lastUpdateTime = ref('')

const {
  showModal,
  snapshotData,
  hasSnapshot,
  modalPosition,
  saveSnapshot,
  loadSnapshot,
  showSnapshotModal,
  closeModal,
  startDrag,
} = useSnapshot()

const { sortField, sortOrder, toggleSort, sortedItems: sortedSites } = useSort(sites)

const currentSites = ref<SiteStatus[]>([])

const onSaveSnapshot = () => {
  const ok = saveSnapshot(currentSites.value)
  alert(ok ? '状态已保存到本地！' : '保存失败，请检查浏览器存储权限')
}

const onShowSnapshotModal = () => {
  if (!showSnapshotModal()) {
    alert('暂无历史记录')
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const url = '/stracker/data/sites.json'
    console.log('正在请求数据文件:', url)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`)
    }
    const data = await response.json()

    if (data.metadata && data.metadata.generatedAt) {
      lastUpdateTime.value = data.metadata.generatedAt
    } else {
      lastUpdateTime.value = new Date().toISOString()
    }

    const sitesData = data.sites || data
    if (!Array.isArray(sitesData)) {
      throw new Error('数据格式错误: sites 不是数组')
    }

    currentSites.value = sitesData

    const snapshot = loadSnapshot()
    if (snapshot && Array.isArray(snapshot.sites)) {
      sites.value = compareWithSnapshot(sitesData, snapshot.sites)
    } else {
      sites.value = sitesData
    }

    loading.value = false
  } catch (err) {
    error.value = '加载网站数据失败，请检查数据文件是否存在'
    console.error('加载数据失败:', err)
    sites.value = []
    loading.value = false
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

.row-highlight {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { background-color: rgba(255, 193, 7, 0.3); }
  50% { background-color: rgba(255, 193, 7, 0.1); }
  100% { background-color: rgba(255, 193, 7, 0.3); }
}

.empty {
  text-align: center;
  padding: 40px;
  color: #666;
}
</style>
