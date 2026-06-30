import { ref, computed } from 'vue'
import type { SiteStatus } from '@/types'
import { useDraggable } from './useDraggable'

const STORAGE_KEY = 'siteSnapshot'

interface SnapshotData {
  timestamp: string
  sites: SiteStatus[]
}

export interface SiteStatusWithSnapshot extends SiteStatus {
  isNew?: boolean
  hasChanges?: boolean
}

export function useSnapshot() {
  const showModal = ref(false)
  const snapshotData = ref<SnapshotData | null>(null)
  const hasSnapshot = computed(() => !!localStorage.getItem(STORAGE_KEY))

  const {
    isDragging,
    position: modalPosition,
    startDrag
  } = useDraggable()

  const saveSnapshot = (sites: SiteStatus[]) => {
    try {
      const snapshot: SnapshotData = {
        timestamp: new Date().toISOString(),
        sites: sites || []
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
      alert('状态已保存到本地！')
    } catch (err) {
      console.error('保存状态失败:', err)
      alert('保存失败，请检查浏览器存储权限')
    }
  }

  const loadSnapshot = (): SnapshotData | null => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return null
      const parsed = JSON.parse(saved)
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

  const showSnapshotModal = () => {
    const saved = localStorage.getItem(STORAGE_KEY)
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

  const compareWithSnapshot = (
    currentSites: SiteStatus[],
    snapshotSites: SiteStatusWithSnapshot[]
  ): SiteStatusWithSnapshot[] => {
    if (!Array.isArray(snapshotSites)) {
      return currentSites.map(site => ({ ...site, isNew: true }))
    }

    const snapshotMap = new Map(snapshotSites.map(site => [site.name, site]))

    const hasFieldChanged = (field: keyof SiteStatus, site: SiteStatus, snapshot: SiteStatus): boolean =>
      site[field] != null && snapshot[field] != null && site[field] !== snapshot[field]

    return currentSites.map(site => {
      const snapshot = snapshotMap.get(site.name)
      if (!snapshot) {
        return { ...site, isNew: true }
      }

      const hasChanges =
        hasFieldChanged('latestVersion', site, snapshot) ||
        hasFieldChanged('packageVersion', site, snapshot) ||
        hasFieldChanged('lastCommitTime', site, snapshot) ||
        hasFieldChanged('packageUpdateTime', site, snapshot)

      return { ...site, hasChanges }
    })
  }

  return {
    showModal,
    snapshotData,
    hasSnapshot,
    isDragging,
    modalPosition,
    saveSnapshot,
    loadSnapshot,
    showSnapshotModal,
    closeModal,
    startDrag,
    compareWithSnapshot
  }
}
