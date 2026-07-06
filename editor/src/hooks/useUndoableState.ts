import { useCallback, useRef, useState } from 'react'

const DEBOUNCE_MS = 700
const MAX_HISTORY = 50

type Updater<T> = T | ((prev: T) => T)

/**
 * Like useState, but keeps a history stack so callers can undo the last change.
 * Rapid consecutive updates (e.g. typing) within DEBOUNCE_MS of each other are
 * coalesced into a single history entry, so undo reverts a whole edit rather
 * than one keystroke at a time.
 */
export function useUndoableState<T>(initial: T | (() => T)) {
  const [value, setValue] = useState<T>(initial)
  const historyRef = useRef<T[]>([])
  const lastChangeAtRef = useRef(0)
  const [canUndo, setCanUndo] = useState(false)

  const set = useCallback((updater: Updater<T>) => {
    setValue((prev) => {
      const next = typeof updater === 'function' ? (updater as (prev: T) => T)(prev) : updater
      if (next === prev) return prev

      const now = Date.now()
      if (now - lastChangeAtRef.current > DEBOUNCE_MS) {
        historyRef.current.push(prev)
        if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
        setCanUndo(true)
      }
      lastChangeAtRef.current = now
      return next
    })
  }, [])

  const undo = useCallback(() => {
    setValue((current) => {
      const previous = historyRef.current.pop()
      if (previous === undefined) return current
      setCanUndo(historyRef.current.length > 0)
      lastChangeAtRef.current = 0
      return previous
    })
  }, [])

  return { value, set, undo, canUndo }
}
