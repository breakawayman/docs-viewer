import { memo, isValidElement, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import MermaidBlock from '@/components/docs/MermaidBlock'
import 'highlight.js/styles/github-dark-dimmed.css'

type Props = {
  raw: string
  className?: string
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (isValidElement(value)) return toText((value as any).props?.children)
  if (Array.isArray(value)) return value.map(toText).join('')
  return ''
}

const LANG_LABEL: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  js: 'JavaScript',
  ts: 'TypeScript',
  tsx: 'TSX',
  jsx: 'JSX',
  python: 'Python',
  py: 'Python',
  java: 'Java',
  go: 'Go',
  golang: 'Go',
  rust: 'Rust',
  rs: 'Rust',
  c: 'C',
  cpp: 'C++',
  'c++': 'C++',
  'c#': 'C#',
  csharp: 'C#',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kotlin: 'Kotlin',
  dart: 'Dart',
  scala: 'Scala',
  shell: 'Shell',
  sh: 'Shell',
  bash: 'Bash',
  zsh: 'Zsh',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
  sql: 'SQL',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  less: 'Less',
  markdown: 'Markdown',
  md: 'Markdown',
  text: 'Text',
  plaintext: 'Text',
  http: 'HTTP',
  curl: 'cURL',
  diff: 'Diff',
  dockerfile: 'Dockerfile',
  graphql: 'GraphQL',
}

function detectLangLabel(className?: string) {
  if (!className) return null
  const match = className.match(/language-([\w+#-]+)/i)
  if (!match) return null
  const raw = match[1].toLowerCase()
  return LANG_LABEL[raw] ?? raw.toUpperCase()
}

async function copyToClipboard(text: string) {
  if (!text) return false
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {}

  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', 'true')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    ta.style.top = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

const REMARK_PLUGINS = [remarkGfm] as any
const REHYPE_PLUGINS = [
  rehypeSlug,
  [rehypeAutolinkHeadings, { behavior: 'wrap' }],
  rehypeHighlight,
] as any

function CodeBlock({
  text,
  codeClassName,
  children,
}: {
  text: string
  codeClassName?: string
  children: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const langLabel = detectLangLabel(codeClassName)

  return (
    <div className="group relative my-6">
      <div
        className={cn(
          'relative rounded-2xl overflow-hidden',
          'border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
          'dark:border dark:border-zinc-800/80 dark:bg-zinc-900 dark:shadow-[0_0_0_1px_rgba(63,63,70,0.25),0_10px_30px_-12px_rgba(0,0,0,0.6)]',
        )}
      >
        <div className="relative flex items-center justify-between gap-2 border-b border-zinc-200/60 bg-zinc-100/90 px-4 py-2.5 dark:border-zinc-800/80 dark:bg-zinc-800/85">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 opacity-90">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70 shadow-inner" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70 shadow-inner" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400/70 shadow-inner" />
            </span>
            <span
              className={cn(
                'select-none text-[11px] font-medium tracking-wide',
                'text-zinc-500 dark:text-zinc-400',
              )}
            >
              {langLabel ?? 'Code'}
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              const ok = await copyToClipboard(text)
              if (!ok) return
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1400)
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-all',
              'border-zinc-200/70 bg-white text-zinc-600 opacity-100 hover:bg-zinc-50 hover:text-zinc-900 md:opacity-0 md:group-hover:opacity-100',
              'dark:border-zinc-700/80 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100',
            )}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
        <div className="relative overflow-x-auto bg-white dark:bg-zinc-900/90">
          <pre className="m-0 bg-transparent px-4 py-3.5 text-[13px] leading-6 text-zinc-900 dark:text-zinc-300">
            {children}
          </pre>
        </div>
      </div>
    </div>
  )
}

const MD_COMPONENTS = {
  pre: ({ children }: any) => {
    const text = toText(children).trimEnd()
    const codeChild = Array.isArray(children) ? children[0] : children
    const codeClassName = (codeChild as any)?.props?.className as string | undefined
    const isMermaid = !!codeClassName && /language-mermaid/i.test(codeClassName)

    if (isMermaid) {
      return <MermaidBlock chart={text} />
    }

    return (
      <CodeBlock text={text} codeClassName={codeClassName}>
        {children}
      </CodeBlock>
    )
  },
  code: ({ className, children, ...props }: any) => {
    const inline = !String(className ?? '').includes('language-')
    if (!inline) {
      const isMermaid = /language-mermaid/i.test(String(className ?? ''))
      if (isMermaid) {
        return (
          <code className={cn('hljs block hidden')} {...props}>
            {children}
          </code>
        )
      }
      return (
        <code className={cn('hljs block')} {...props}>
          {children}
        </code>
      )
    }

    return (
      <code
        className={cn(
          'rounded-md px-1.5 py-0.5 text-[0.9em] font-medium',
          'border border-zinc-200/80 bg-zinc-50 text-zinc-800 shadow-[0_1px_0_rgba(0,0,0,0.02)]',
          'dark:border dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-200 dark:shadow-[inset_0_0_0_1px_rgba(63,63,70,0.25)]',
        )}
        {...props}
      >
        {children}
      </code>
    )
  },
  a: ({ className, ...props }: any) => (
    <a
      className={cn(
        'text-zinc-900 underline decoration-zinc-400 underline-offset-4 hover:decoration-zinc-900 hover:decoration-2',
        'dark:text-indigo-300 dark:decoration-indigo-500/60 dark:hover:text-indigo-200 dark:hover:decoration-indigo-300',
        className,
      )}
      {...props}
    />
  ),
  table: ({ className, ...props }: any) => (
    <table
      className={cn(
        'my-6 w-full overflow-hidden rounded-xl border border-zinc-200/70 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        'dark:border dark:border-zinc-800/80 dark:shadow-[0_0_0_1px_rgba(63,63,70,0.15)]',
        className,
      )}
      {...props}
    />
  ),
  thead: ({ className, ...props }: any) => (
    <thead
      className={cn(
        'bg-gradient-to-b from-zinc-100 to-zinc-50',
        'dark:from-zinc-900 dark:to-zinc-950',
        className,
      )}
      {...props}
    />
  ),
  th: ({ className, ...props }: any) => (
    <th
      className={cn(
        'border-b border-zinc-200/80 px-4 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-700',
        'dark:border-b dark:border-zinc-800 dark:text-zinc-200',
        className,
      )}
      {...props}
    />
  ),
  tr: ({ className, ...props }: any) => (
    <tr
      className={cn(
        'border-b border-zinc-100 transition-colors last:border-none hover:bg-zinc-50/60',
        'dark:border-zinc-900 dark:hover:bg-zinc-900/40',
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }: any) => (
    <td
      className={cn(
        'px-4 py-2.5 align-top text-zinc-700',
        'dark:text-zinc-300',
        className,
      )}
      {...props}
    />
  ),
  blockquote: ({ className, ...props }: any) => (
    <blockquote
      className={cn(
        'my-6 rounded-r-xl border-l-4 border-zinc-300 bg-zinc-50/60 px-4 py-3 text-zinc-700',
        'dark:border-l-indigo-500/70 dark:bg-gradient-to-r dark:from-zinc-900/80 dark:to-transparent dark:text-zinc-200',
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }: any) => (
    <hr
      className={cn(
        'my-10 border-t border-zinc-200/80',
        'dark:border-t dark:border-zinc-800/80',
        className,
      )}
      {...props}
    />
  ),
}

function DocContentInner({ raw, className }: Props) {
  return (
    <div
      className={cn(
        'rounded-[18px] border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_-20px_rgba(0,0,0,0.15)]',
        'border-zinc-300/90 p-6 pb-8 sm:p-8 sm:pb-10',
        'dark:border-zinc-700/80 dark:bg-zinc-900/55',
        'dark:shadow-[0_0_0_1px_rgba(39,39,42,0.35),0_20px_60px_-30px_rgba(0,0,0,0.75)]',
      )}
    >
      <div
        className={cn(
          'min-w-0',
          'prose prose-zinc max-w-none dark:prose-invert',
          'prose-headings:scroll-mt-24 prose-headings:font-semibold',
          'prose-h1:text-3xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-[15.5px] prose-h4:font-semibold',
          'prose-code:before:content-none prose-code:after:content-none',
          'prose-a:font-medium prose-a:no-underline hover:prose-a:underline',
          'prose-table:my-6 prose-table:w-full prose-table:overflow-hidden prose-table:rounded-xl prose-table:border prose-table:border-zinc-200/70 prose-table:text-sm dark:prose-table:border-zinc-800/80',
          'prose-th:bg-zinc-100 prose-th:font-semibold prose-th:uppercase prose-th:tracking-wide dark:prose-th:bg-zinc-900/80',
          'prose-th:border-b prose-th:border-zinc-200/70 dark:prose-th:border-b dark:prose-th:border-zinc-800/80',
          'prose-tr:border-b prose-tr:border-zinc-100 last:prose-tr:border-none dark:prose-tr:border-zinc-900 last:dark:prose-tr:border-none',
          className,
        )}
      >
        <ReactMarkdown
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={REHYPE_PLUGINS}
          components={MD_COMPONENTS}
        >
          {raw}
        </ReactMarkdown>
      </div>
    </div>
  )
}

export default memo(
  DocContentInner,
  (a, b) => a.raw === b.raw && a.className === b.className,
)
