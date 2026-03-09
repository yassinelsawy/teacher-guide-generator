import { useEffect, useRef, useState } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const STORAGE_KEY = 'teacher-guide-v1'
const DEBOUNCE_MS = 1500

export function useAutoSave<T>(data: T) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }

    if (timer.current) clearTimeout(timer.current)
    setStatus('saving')

    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        setStatus('saved')
      } catch {
        setStatus('error')
      }
      timer.current = setTimeout(() => setStatus('idle'), 2500)
    }, DEBOUNCE_MS)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [data])

  return { status }
}

export function loadSaved<T>(): T | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function clearSaved() {
  localStorage.removeItem(STORAGE_KEY)
}
