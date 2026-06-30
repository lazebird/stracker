export async function withFallback<T>(
  strategies: Array<() => Promise<T>>,
  options?: { onError?: (e: unknown, index: number) => void }
): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < strategies.length; i++) {
    try {
      return await strategies[i]()
    } catch (e) {
      lastError = e
      options?.onError?.(e, i)
    }
  }
  throw lastError
}

/** 创建带超时的 Promise，用于对外部请求设置超时保护 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 30000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`请求超时 (${timeoutMs}ms)`)), timeoutMs)
    }),
  ])
}
