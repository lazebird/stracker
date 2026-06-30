import { ref } from 'vue'

export function useDraggable(initialX = 100, initialY = 100) {
  const isDragging = ref(false)
  const position = ref({ x: initialX, y: initialY })
  const offset = ref({ x: 0, y: 0 })

  const onDrag = (event: MouseEvent) => {
    if (!isDragging.value) return
    position.value = {
      x: event.clientX - offset.value.x,
      y: event.clientY - offset.value.y
    }
  }

  const stopDrag = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup', stopDrag)
  }

  const startDrag = (event: MouseEvent) => {
    isDragging.value = true
    const target = event.currentTarget as HTMLElement | null
    const parent = target?.parentElement as HTMLElement | null
    if (!parent) return

    offset.value = {
      x: event.clientX - parent.offsetLeft,
      y: event.clientY - parent.offsetTop
    }

    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', stopDrag)
  }

  return {
    isDragging,
    position,
    startDrag
  }
}
