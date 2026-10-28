import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, Folder, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

type DirectoryOption = {
  value: string
  label: string
  group: string
  description?: string
  count?: number
}
type Props = {
  id: string
  value: string
  options: DirectoryOption[]
  placeholder: string
  disabled?: boolean
  onChange: (value: string) => void
}

export default function DirectorySelect({ id, value, options, placeholder, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)
  const expanded = open && !disabled
  const listId = `${id}-listbox`

  useEffect(() => {
    if (!expanded) return
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnFocusOut = (event: FocusEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('focusin', closeOnFocusOut)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('focusin', closeOnFocusOut)
    }
  }, [expanded])

  useEffect(() => {
    if (expanded) list.current?.querySelector(`[data-option-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [active, expanded])

  function show() {
    setActive(Math.max(0, options.findIndex((option) => option.value === value)))
    setOpen(true)
  }
  function choose(index: number) {
    const option = options[index]
    if (!option) return
    setOpen(false)
    trigger.current?.focus()
    if (option.value !== value) onChange(option.value)
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Tab') { setOpen(false); return }
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!expanded) show()
      else setActive((previous) => (previous + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
      return
    }
    if (expanded && (event.key === 'Home' || event.key === 'End')) {
      event.preventDefault()
      setActive(event.key === 'Home' ? 0 : options.length - 1)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (expanded) choose(active)
      else show()
    }
  }

  return (
    <div ref={root} className="relative min-w-0 flex-1">
      <button ref={trigger} id={id} type="button" role="combobox" aria-label="当前文档目录" aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? listId : undefined} aria-activedescendant={expanded ? `${id}-option-${active}` : undefined}
        disabled={disabled} onKeyDown={onKeyDown} onClick={() => { if (expanded) setOpen(false); else show() }}
        title={selected?.label ?? placeholder}
        className={cn('group flex min-h-12 w-full items-center gap-2.5 rounded-xl border bg-white px-3 py-2 text-left shadow-sm outline-none transition-colors disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none',
          'dark:bg-zinc-950/60', expanded ? 'border-indigo-400 ring-[3px] ring-indigo-500/10 dark:border-indigo-500/70 dark:ring-indigo-400/10' : 'border-zinc-200/80 hover:border-indigo-300 hover:bg-indigo-50/30 focus-visible:border-indigo-400 focus-visible:ring-[3px] focus-visible:ring-indigo-500/15 dark:border-zinc-700/70 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/5')}
      >
        <FolderOpen aria-hidden className="h-[18px] w-[18px] shrink-0 text-indigo-500 dark:text-indigo-400" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-100">{selected?.label ?? placeholder}</span>
          {selected?.description && <span className="block truncate text-[10px] leading-4 text-zinc-400 dark:text-zinc-500">{selected.description}</span>}
        </span>
        {selected?.count !== undefined && <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{selected.count} 篇</span>}
        <ChevronDown aria-hidden className={cn('h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-150 motion-reduce:transition-none', expanded && 'rotate-180 text-indigo-500 dark:text-indigo-400')} />
      </button>
      {expanded && (
        <div ref={list} id={listId} role="listbox" aria-label="文档目录" className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[min(20rem,50dvh)] overflow-y-auto rounded-xl border border-zinc-200/80 bg-white p-1.5 shadow-[0_12px_32px_-8px_rgba(24,24,27,0.2),0_2px_8px_rgba(24,24,27,0.04)] dark:border-zinc-700/80 dark:bg-zinc-900 dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6)]">
          {[...new Set(options.map((option) => option.group))].map((group) => (
            <div key={group} role="group" aria-label={group} className="border-t border-zinc-100 pt-1.5 first:border-0 first:pt-0 dark:border-zinc-800">
              <div aria-hidden className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium tracking-wide text-zinc-400 dark:text-zinc-500">{group}</div>
              {options.map((option, index) => {
                if (option.group !== group) return null
                const isSelected = option.value === value
                return (
                  <div key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={isSelected} data-option-index={index}
                    title={option.label} onPointerMove={() => setActive(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}
                    className={cn('mb-0.5 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors motion-reduce:transition-none',
                      active === index ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200' : isSelected ? 'bg-zinc-50 text-indigo-600 dark:bg-zinc-800/60 dark:text-indigo-300' : 'text-zinc-600 dark:text-zinc-300')}
                  >
                    <Folder aria-hidden className={cn('h-4 w-4 shrink-0', isSelected || active === index ? 'text-indigo-500 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500')} />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[13px]', isSelected && 'font-medium')}>{option.label}</span>
                      {option.description && <span className="block truncate text-[10px] leading-4 text-zinc-400 dark:text-zinc-500">{option.description}</span>}
                    </span>
                    {option.count !== undefined && <span className="shrink-0 text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">{option.count} 篇</span>}
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">{isSelected && <Check aria-hidden className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
