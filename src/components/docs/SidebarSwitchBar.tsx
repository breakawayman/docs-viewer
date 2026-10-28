import { cn } from '@/lib/utils'

export type SidebarMode = 'files' | 'toc'

type Props = {
  mode: SidebarMode
  onChange: (mode: SidebarMode) => void
  showFiles: boolean
  showToc: boolean
}

export default function SidebarSwitchBar({ mode, onChange, showFiles, showToc }: Props) {
  if (!(showFiles && showToc)) return null

  return (
    <div
      className={cn(
        'relative flex items-center rounded-xl border p-1',
        'border-zinc-200/70 bg-gradient-to-b from-zinc-50 to-white shadow-[0_1px_0_rgba(0,0,0,0.02)]',
        'dark:border-zinc-800/80 dark:bg-gradient-to-b dark:from-zinc-900/80 dark:to-zinc-950 dark:shadow-[inset_0_0_0_1px_rgba(63,63,70,0.35),0_1px_0_rgba(255,255,255,0.02)]',
      )}
    >
      {/* Indicator pill — the only animating layer.
          Gradients don't interpolate via CSS transitions, so we keep
          the pill static as a single sliding layer instead of toggling
          gradient backgrounds per-button (which would "snap" / flash). */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-1 left-1 z-[1] w-[calc(50%-4px)] rounded-lg',
          'bg-white text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]',
          'dark:bg-gradient-to-b dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-50',
          'dark:shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(63,63,70,0.55)]',
          'transition-transform duration-[220ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] will-change-transform',
        )}
        style={{
          transform:
            mode === 'files' ? 'translate3d(0,0,0)' : 'translate3d(calc(100% + 8px),0,0)',
          boxShadow:
            mode === 'toc'
              ? undefined
              : undefined,
        }}
      >
        {/* Mode-tint inner glow — tiny colored accent on the pill edge so
            files/toc feel distinct without re-rendering the pill itself. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg opacity-[0.85] mix-blend-overlay transition-opacity duration-200"
          style={{
            background:
              mode === 'files'
                ? 'linear-gradient(90deg, rgba(99,102,241,0.25), transparent 60%)'
                : 'linear-gradient(90deg, transparent 40%, rgba(217,70,239,0.22))',
          }}
        />
      </div>

      <button
        type="button"
        onClick={() => onChange('files')}
        className={cn(
          'relative z-10 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
          mode === 'files'
            ? 'text-zinc-950 dark:text-zinc-50'
            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
        )}
      >
        文档目录
      </button>
      <button
        type="button"
        onClick={() => onChange('toc')}
        className={cn(
          'relative z-10 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
          mode === 'toc'
            ? 'text-zinc-950 dark:text-zinc-50'
            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
        )}
      >
        本页目录
      </button>
    </div>
  )
}
