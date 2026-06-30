<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop :style="positionStyle">
      <div class="modal-header" @mousedown="onStartDrag">
        <h3>历史记录快照</h3>
        <button @click="$emit('close')" class="close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div v-if="data" class="snapshot-info">
          <p><strong>记录时间：</strong>{{ formatTime(data.timestamp) }}</p>
          <p><strong>记录站点数：</strong>{{ data.sites?.length || 0 }} 个</p>
        </div>
        <table v-if="data && data.sites" class="snapshot-table">
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
            <tr v-for="site in (data.sites || [])" :key="site.name">
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
        <div v-else class="empty-snapshot">暂无历史记录</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SiteStatus } from '@/types'
import { formatTime, getStatusText } from '@/utils/format'

defineProps<{
  show: boolean
  data: { timestamp: string; sites: SiteStatus[] } | null
  positionStyle: { top: string; left: string }
}>()

const emit = defineEmits<{
  close: []
  startDrag: [event: MouseEvent]
}>()

const onStartDrag = (event: MouseEvent) => {
  emit('startDrag', event)
}
</script>

<style scoped>
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
</style>
