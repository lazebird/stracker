import { ref, computed } from 'vue'
import type { SiteStatus } from '@/types'
import { useDraggable } from './useDraggable'

const STORAGE_KEY = 'siteSnapshot'

export interface SnapshotData {
  timestamp: string
  sites: SiteStatus[]
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

  const saveSnapshot = (sites: SiteStatus[]): boolean => {
    try {
      const snapshot: SnapshotData = {
        timestamp: new Date().toISOString(),
        sites: sites || []
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
      return true
    } catch (err) {
      console.error('保存状态失败:', err)
      return false
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

  const showSnapshotModal = (): boolean => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      snapshotData.value = JSON.parse(saved)
      showModal.value = true
      return true
    }
    return false
  }

  const closeModal = () => {
    showModal.value = false
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
  }
}
