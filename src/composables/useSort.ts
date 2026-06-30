import { ref, computed, type Ref } from 'vue'

export type SortField = 'codeUpdateTime' | 'versionUpdateTime' | 'containerUpdateTime'

export function useSort<T extends {
  type?: string
  lastCommitTime?: string
  lastUpdateTime?: string
  packageUpdateTime?: string
}>(items: Ref<T[]>) {
  const sortField = ref<SortField | null>(null)
  const sortOrder = ref<'asc' | 'desc'>('desc')

  const toggleSort = (field: SortField) => {
    if (sortField.value === field) {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortField.value = field
      sortOrder.value = 'desc'
    }
  }

  const getSortValue = (item: T): string | null => {
    switch (sortField.value) {
      case 'codeUpdateTime':
        return item.type === 'Docker Hub镜像'
          ? null
          : (item.lastCommitTime || item.lastUpdateTime || null)
      case 'versionUpdateTime':
        return item.lastUpdateTime || null
      case 'containerUpdateTime':
        return item.type === 'GitHub网站' ? (item.packageUpdateTime || null) : null
      default:
        return null
    }
  }

  const sortedItems = computed(() => {
    if (!sortField.value) return items.value

    return [...items.value].sort((a, b) => {
      const aValue = getSortValue(a)
      const bValue = getSortValue(b)

      if (aValue === null && bValue === null) return 0
      if (aValue === null) return 1
      if (bValue === null) return -1

      const comparison = new Date(aValue).getTime() - new Date(bValue).getTime()
      return sortOrder.value === 'asc' ? comparison : -comparison
    })
  })

  return {
    sortField,
    sortOrder,
    toggleSort,
    sortedItems
  }
}
