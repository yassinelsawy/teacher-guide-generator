import { useEffect, useRef, useState } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// localStorage caps out around 5-10MB per origin, which imported/edited guides
// with embedded images can exceed (silently, as a caught QuotaExceededError).
// IndexedDB's quota is far larger, so the guide lives there instead - shared
// with the landing page's import flow via the same DB/store/key names (see
// static/app.js).
const DB_NAME = 'teacher-guide-editor'
const STORE_NAME = 'guide'
const DB_VERSION = 1
const GUIDE_KEY = 'teacherGuideData'
const LEGACY_KEYS = ['teacherGuideData', 'teacher-guide-v1']
const DEBOUNCE_MS = 1500

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key)
    request.onsuccess = () => resolve((request.result as T) ?? null)
    request.onerror = () => reject(request.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

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
      idbSet(GUIDE_KEY, data)
        .then(() => setStatus('saved'))
        .catch(() => setStatus('error'))
        .finally(() => {
          timer.current = setTimeout(() => setStatus('idle'), 2500)
        })
    }, DEBOUNCE_MS)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [data])

  return { status }
}

// One-time migration for guides saved by older builds under localStorage.
async function migrateLegacyLocalStorage<T>(): Promise<T | null> {
  let parsed: T | null = null
  try {
    for (const key of LEGACY_KEYS) {
      const raw = localStorage.getItem(key)
      if (raw) {
        parsed = JSON.parse(raw) as T
        break
      }
    }
    if (parsed) await idbSet(GUIDE_KEY, parsed)
  } catch {
    return null
  }
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key))
  return parsed
}

export async function loadSaved<T>(): Promise<T | null> {
  try {
    const fromDb = await idbGet<T>(GUIDE_KEY)
    if (fromDb) return fromDb
  } catch {
    // fall through to the legacy localStorage check below
  }
  return migrateLegacyLocalStorage<T>()
}

export async function saveGuide(data: unknown): Promise<void> {
  await idbSet(GUIDE_KEY, data)
}

export async function clearSaved(): Promise<void> {
  try {
    await idbDelete(GUIDE_KEY)
  } catch {
    // ignore
  }
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key))
}
