import { useCallback, useEffect, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const THEME_ATTR = 'data-theme'

function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStoredTheme(): Theme | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
    return null
  } catch {
    return null
  }
}

function readDomTheme(): Theme | null {
  if (typeof document === 'undefined') return null
  const root = document.documentElement
  if (root.getAttribute(THEME_ATTR) === 'dark') return 'dark'
  if (root.getAttribute(THEME_ATTR) === 'light') return 'light'
  if (root.classList.contains('dark')) return 'dark'
  if (root.classList.contains('light')) return 'light'
  return null
}

function resolveInitialTheme(): Theme {
  return readDomTheme() ?? readStoredTheme() ?? getSystemTheme()
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.removeAttribute(THEME_ATTR)
  root.classList.add(theme)
  root.setAttribute(THEME_ATTR, theme)
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {}
  }
}

let currentTheme: Theme | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) {
    try {
      l()
    } catch {}
  }
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

function getSnapshot(): Theme {
  if (currentTheme == null) {
    currentTheme = resolveInitialTheme()
    applyTheme(currentTheme)
  }
  return currentTheme
}

function getServerSnapshot(): Theme {
  return 'light'
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    applyTheme(theme)
    currentTheme = theme
    emit()
  }, [theme])

  const toggleTheme = useCallback(() => {
    const next: Theme = getSnapshot() === 'light' ? 'dark' : 'light'
    currentTheme = next
    applyTheme(next)
    emit()
  }, [])

  return {
    theme,
    toggleTheme,
    isDark: theme === 'dark',
  } as const
}
