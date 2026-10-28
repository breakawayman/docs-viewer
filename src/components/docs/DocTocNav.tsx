import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { TocItem } from '@/docs/toc'

type Props = {
  toc: TocItem[]
  contentRootId?: string
}

function flatten(items: TocItem[]) {
  const out: TocItem[] = []
  const walk = (list: TocItem[]) => {
    for (const it of list) {
      out.push(it)
      if (it.children.length > 0) walk(it.children)
    }
  }
  walk(items)
  return out
}

export default function DocTocNav({ toc, contentRootId = 'doc-content' }: Props) {
  const flat = useMemo(() => flatten(toc), [toc])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const rootEl = document.getElementById(contentRootId)
    if (!rootEl) return

    const headings = flat
      .map((it) => {
        const el = document.getElementById(it.id)
        return el ? ({ id: it.id, el } as const) : null
      })
      .filter(Boolean) as Array<{ readonly id: string; readonly el: HTMLElement }>

    if (headings.length === 0) return

    let raf = 0
    const threshold = 16
    const tolerance = 4

    // Zero-layout scroll-spy: headings stay inside `rootEl` (which is a
    // positioned scroll container) so we can use raw offsetTop vs the
    // current scrollTop instead of getBoundingClientRect (which forces
    // synchronous layout N times per scroll, killing perf on big docs).
    const updateActive = () => {
      raf = 0
      const scrollTop = rootEl.scrollTop
      let candidateId = headings[0]?.id ?? null
      for (let i = 0; i < headings.length; i++) {
        const { id, el } = headings[i]
        const relativeTop = el.offsetTop - scrollTop
        if (relativeTop <= threshold + tolerance) {
          candidateId = id
        }
      }
      setActiveId((prev) => (prev === candidateId ? prev : candidateId))
    }

    const onScroll = () => {
      if (raf) return
      raf = window.requestAnimationFrame(updateActive)
    }

    rootEl.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    updateActive()

    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      rootEl.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [contentRootId, flat])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    setActiveId(id)
    const rootEl = document.getElementById(contentRootId)
    if (rootEl) {
      const threshold = 16
      const top = el.offsetTop - threshold + 1
      rootEl.scrollTo({ top, behavior: 'smooth' })
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    const url = `${window.location.pathname}${window.location.search}#${id}`
    window.history.replaceState(null, '', url)
  }

  const renderItem = (item: TocItem) => {
    if (item.level === 1) {
      return (
        <div key={item.id} className="space-y-1">
          <div
            className={cn(
              'mt-4 mb-2 border-t border-zinc-200/60 pt-3 first:mt-0 first:border-t-0 first:pt-1',
              'dark:border-zinc-800/70',
            )}
          >
            <div className="px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
              {item.text}
            </div>
          </div>
          {item.children.map(renderItem)}
        </div>
      )
    }

    const isActive = activeId === item.id
    const pad =
      item.level === 2 ? 'pl-1' : item.level === 3 ? 'pl-6' : 'pl-10'

    return (
      <div key={item.id} className={cn('space-y-1', pad)}>
        <div className="relative">
          {isActive ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-gradient-to-b from-indigo-400 to-violet-500"
            />
          ) : null}
          <button
            type="button"
            onClick={() => scrollTo(item.id)}
            className={cn(
              'relative w-full rounded-lg px-3 py-1.5 text-left transition-all duration-150',
              isActive
                ? [
                    'pl-4 font-semibold text-zinc-950',
                    'bg-gradient-to-r from-zinc-200/80 to-zinc-100 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.04)]',
                    'dark:from-indigo-500/15 dark:via-zinc-800/70 dark:to-zinc-800/40 dark:pl-4 dark:font-semibold dark:text-zinc-50 dark:shadow-[inset_0_0_0_1px_rgba(99,102,241,0.22)]',
                  ]
                : [
                    'pl-4 text-zinc-600 hover:bg-zinc-100/60 hover:text-zinc-900',
                    'dark:pl-4 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100 dark:hover:shadow-[inset_0_0_0_1px_rgba(63,63,70,0.45)]',
                    item.level === 3 ? 'text-[13px]' : '',
                    item.level === 4 ? 'text-[12.5px] text-zinc-500 dark:text-zinc-500/90' : '',
                  ],
            )}
          >
            <span className="block truncate">{item.text}</span>
          </button>
        </div>
        {item.children.map(renderItem)}
      </div>
    )
  }

  return <nav className="space-y-0.5 pb-2 pt-1">{toc.map(renderItem)}</nav>
}
