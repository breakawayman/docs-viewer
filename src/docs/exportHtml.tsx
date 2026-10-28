import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeHighlight from 'rehype-highlight'
import { renderMermaid } from './mermaidRenderer'
import type { TocItem } from './toc'

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
  const m = className.match(/language-([\w+#-]+)/i)
  if (!m) return null
  const raw = m[1].toLowerCase()
  return LANG_LABEL[raw] ?? raw.toUpperCase()
}

function flattenToc(items: TocItem[]) {
  const out: Array<{ id: string; text: string; level: 1 | 2 | 3 | 4 }> = []
  const walk = (nodes: TocItem[]) => {
    for (const n of nodes) {
      if (n.id !== 'toc')
        out.push({ id: n.id, text: n.text, level: n.level as 1 | 2 | 3 | 4 })
      if (n.children.length > 0) walk(n.children)
    }
  }
  walk(items)
  return out
}

function sanitizeFileName(input: string) {
  return input
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function renderToc(toc: TocItem[]) {
  const flat = flattenToc(toc)
  return (
    <nav className="toc">
      <div className="doc-brand">
        <div>
          <div className="doc-brand-title">文档目录</div>
          <div className="doc-brand-sub">Markdown 驱动 · Static Export</div>
        </div>
      </div>
      {flat.length > 0 ? (
        <>
          <div className="toc-title">Contents</div>
          <ul className="toc-list">
            {flat.map((it) => (
              <li key={it.id} className={`toc-item toc-l${it.level}`}>
                <a href={`#${it.id}`}>{it.text}</a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </nav>
  )
}

function extractMermaidBlocks(raw: string): string[] {
  const re = /```mermaid\s*([\s\S]*?)```/gi
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const src = m[1].trim()
    if (src) out.push(src)
  }
  return out
}

async function preRenderMermaid(
  raw: string,
  theme: 'default' | 'dark' = 'default',
): Promise<Map<string, { svg: string; error: string | null }>> {
  const blocks = extractMermaidBlocks(raw)
  const result = new Map<string, { svg: string; error: string | null }>()
  if (blocks.length === 0) return result

  for (const src of blocks) {
    if (result.has(src)) continue
    try {
      const { svg } = await renderMermaid(src, theme === 'dark')
      result.set(src, { svg, error: null })
    } catch (err) {
      const message =
        typeof err === 'object' && err != null && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : String(err ?? 'Mermaid 渲染失败')
      result.set(src, { svg: '', error: message || 'Mermaid 渲染失败' })
    }
  }
  return result
}

function renderContent(raw: string, mermaidMap: Map<string, { svg: string; error: string | null }>) {
  return (
    <div className="doc-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: 'wrap' }],
          rehypeHighlight,
        ]}
        components={{
          pre: ({ children }: any) => {
            const codeChild = Array.isArray(children) ? children[0] : children
            const codeClassName = (codeChild as any)?.props?.className as string | undefined
            const langLabel = detectLangLabel(codeClassName)
            const isMermaid = !!codeClassName && /language-mermaid/i.test(codeClassName)
            if (isMermaid) {
              const src = String((codeChild as any)?.props?.children ?? '').trim()
              const rendered = mermaidMap.get(src)
              if (rendered?.svg) {
                return (
                  <div className="export-mermaid">
                    <div className="export-mermaid-header">
                      <div className="export-mermaid-header-left">
                        <span className="export-mermaid-dots"><i /><i /><i /></span>
                        <span className="export-mermaid-lang">Mermaid Diagram</span>
                      </div>
                      <span className="export-mermaid-lang-badge">Mermaid</span>
                    </div>
                    <div
                      className="export-mermaid-body"
                      dangerouslySetInnerHTML={{ __html: rendered.svg }}
                    />
                  </div>
                )
              }
              if (rendered?.error) {
                return (
                  <div className="export-mermaid export-mermaid-error">
                    <div className="export-mermaid-header">
                      <div className="export-mermaid-header-left">
                        <span className="export-mermaid-dots"><i /><i /><i /></span>
                        <span className="export-mermaid-lang">Mermaid Diagram</span>
                      </div>
                      <span className="export-mermaid-lang-badge">Error</span>
                    </div>
                    <div className="export-mermaid-body">
                      <div className="mermaid-error-title">⚠ 图表语法错误</div>
                      <pre className="mermaid-error-pre">{rendered.error}</pre>
                      <details className="mermaid-error-src">
                        <summary>查看原始源码</summary>
                        <pre>{src}</pre>
                      </details>
                    </div>
                  </div>
                )
              }
            }
            return (
              <div className="export-code">
                <div className="export-code-hd">
                  <div className="export-code-hd-left">
                    <span className="export-code-dots"><i /><i /><i /></span>
                    <span className="export-code-lang">{langLabel ?? 'Code'}</span>
                  </div>
                  {langLabel ? <span className="export-code-lang-badge">{langLabel}</span> : null}
                </div>
                <div className="export-code-body">
                  <pre className="export-code-pre">{children}</pre>
                </div>
              </div>
            )
          },
          code: ({ className, children, ...props }: any) => {
            const inline = !String(className ?? '').includes('language-')
            if (!inline) {
              return <code className={className} {...props}>{children}</code>
            }
            return <code className="inline-code" {...props}>{children}</code>
          },
          table: ({ ...props }: any) => <table {...props} />,
          thead: ({ ...props }: any) => <thead {...props} />,
          tbody: ({ ...props }: any) => <tbody {...props} />,
          th: ({ ...props }: any) => <th {...props} />,
          tr: ({ ...props }: any) => <tr {...props} />,
          td: ({ ...props }: any) => <td {...props} />,
          blockquote: ({ ...props }: any) => <blockquote {...props} />,
          a: ({ ...props }: any) => <a {...props} />,
          hr: ({ ...props }: any) => <hr {...props} />,
        }}
      >
        {raw}
      </ReactMarkdown>
    </div>
  )
}

export async function createStaticHtmlDocument(params: {
  title: string
  raw: string
  toc: TocItem[]
  theme?: 'light' | 'dark'
}) {
  const isDark = params.theme === 'dark'
  const exportTheme = isDark ? 'dark' : 'default'
  const mermaidMap = await preRenderMermaid(params.raw, exportTheme)

  const lightCss = {
    pageBg: 'linear-gradient(180deg,#fafafa,#ffffff)',
    pageFg: '#09090b',
    mutedFg: '#52525b',
    headingFg: '#09090b',
    border: 'rgba(39,39,42,0.10)',
    strongBorder: 'rgba(39,39,42,0.14)',
    panelBg: '#ffffff',
    panelBgAlt: 'linear-gradient(180deg,#ffffff,#fafafa)',
    sidebarBg: 'linear-gradient(180deg,#ffffff,#fafafa)',
    tocCardBg: '#ffffff',
    codeBg: '#ffffff',
    codeHdBg: 'rgba(244,244,245,0.9)',
    codeInBg: 'rgba(244,244,245,0.70)',
    codeInFg: '#27272a',
    codeFg: '#18181b',
    tableHdBg: 'linear-gradient(180deg,rgba(244,244,245,0.95),rgba(250,250,250,0.95))',
    thBg: 'rgba(244,244,245,0.70)',
    trBg: 'rgba(250,250,250,0.55)',
    quoteBg: 'rgba(244,244,245,0.45)',
    quoteBorder: 'rgba(39,39,42,0.35)',
    linkFg: '#09090b',
    linkDec: 'rgba(39,39,42,0.45)',
    linkHoverDec: '#09090b',
    hlKeyword: '#8b5cf6',
    hlString: '#b45309',
    hlAttr: '#2563eb',
    hlNumber: '#ca8a04',
    hlComment: '#71717a',
    hlTitle: '#18181b',
  } as const

  const darkCss = {
    pageBg: 'radial-gradient(1200px 600px at -10% -20%,rgba(99,102,241,0.12),transparent 60%),radial-gradient(900px 500px at 110% -10%,rgba(217,70,239,0.08),transparent 60%),linear-gradient(180deg,#09090b,#030712)',
    pageFg: '#e4e4e7',
    mutedFg: '#a1a1aa',
    headingFg: '#fafafa',
    border: 'rgba(63,63,70,0.55)',
    strongBorder: 'rgba(63,63,70,0.75)',
    panelBg: 'rgba(24,24,27,0.55)',
    panelBgAlt: 'linear-gradient(180deg,rgba(39,39,42,0.70),rgba(24,24,27,0.45))',
    sidebarBg: 'linear-gradient(180deg,#05060a,#030712)',
    tocCardBg: 'rgba(24,24,27,0.65)',
    codeBg: 'rgba(24,24,27,0.85)',
    codeHdBg: 'rgba(39,39,42,0.85)',
    codeInBg: 'rgba(39,39,42,0.85)',
    codeInFg: '#e4e4e7',
    codeFg: '#cbd0d8',
    tableHdBg: 'linear-gradient(180deg,rgba(39,39,42,0.95),rgba(24,24,27,0.70))',
    thBg: 'rgba(39,39,42,0.70)',
    trBg: 'rgba(24,24,27,0.55)',
    quoteBg: 'linear-gradient(90deg,rgba(39,39,42,0.55),rgba(24,24,27,0.25))',
    quoteBorder: 'rgba(99,102,241,0.75)',
    linkFg: '#a5b4fc',
    linkDec: 'rgba(99,102,241,0.65)',
    linkHoverDec: '#c7d2fe',
    hlKeyword: '#f472b6',
    hlString: '#fdba74',
    hlAttr: '#93c5fd',
    hlNumber: '#fbbf24',
    hlComment: '#71717a',
    hlTitle: '#cbd0d8',
  } as const

  const t = isDark ? darkCss : lightCss
  const colorScheme = isDark ? 'dark' : 'light'

  const css = `
    :root { color-scheme: ${colorScheme}; }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; scrollbar-gutter: stable; scrollbar-color: ${isDark ? '#3f3f46 #09090b' : '#d4d4d8 #ffffff'}; scrollbar-width: thin; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
      line-height: 1.6;
      color: ${t.pageFg};
      background: ${t.pageBg};
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3, h4 {
      font-family: "Fraunces", ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
      font-weight: 650;
      letter-spacing: -0.01em;
      color: ${t.headingFg};
      scroll-margin-top: 18px;
    }
    h1 { font-size: 34px; line-height: 1.18; margin: 4px 0 18px; }
    h2 { font-size: 22px; line-height: 1.25; margin: 34px 0 12px; padding-top: 4px; }
    h3 { font-size: 17px; line-height: 1.35; margin: 22px 0 10px; }
    h4 { font-size: 15.5px; line-height: 1.4; margin: 18px 0 8px; }
    p { margin: 12px 0; }
    strong { color: ${t.headingFg}; }
    ul, ol { margin: 10px 0 10px 22px; padding: 0; }
    li { margin: 6px 0; }
    hr { border: 0; border-top: 1px solid ${t.strongBorder}; margin: 36px 0; }
    a { color: ${isDark ? t.linkFg : '#09090b'}; text-decoration: underline; text-decoration-color: ${t.linkDec}; text-underline-offset: 4px; text-decoration-thickness: 1px; transition: all 160ms ease; }
    a:hover { text-decoration-color: ${isDark ? t.linkHoverDec : '#000000'}; text-decoration-thickness: 2px; }
    code, pre, kbd, samp { font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${isDark ? '#27272a' : '#e4e4e7'}; border: 2px solid transparent; background-clip: padding-box; border-radius: 9999px; }
    ::-webkit-scrollbar-thumb:hover { background: ${isDark ? '#3f3f46' : '#d4d4d8'}; background-clip: padding-box; border: 2px solid transparent; border-radius: 9999px; }
    ::-webkit-scrollbar-corner { background: transparent; }

    .page-shell { padding: 28px 24px 64px; }
    .page { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 28px; max-width: 1320px; margin: 0 auto; }
    @media (max-width: 980px) { .page { grid-template-columns: 1fr; } .toc { position: static !important; max-height: none !important; } .toc-list { overflow: visible !important; } .page-shell { padding: 20px 16px 48px; } }

    /* Sidebar / TOC card */
    .toc {
      position: sticky; top: 20px; align-self: start;
      border: 1px solid ${t.strongBorder};
      background: ${t.sidebarBg};
      border-radius: 18px;
      padding: 16px 14px;
      display: flex; flex-direction: column;
      max-height: calc(100vh - 40px);
      ${isDark ? 'box-shadow: inset 0 0 0 1px rgba(39,39,42,0.55), 0 1px 0 rgba(255,255,255,0.02);' : 'box-shadow: 0 1px 2px rgba(0,0,0,0.03), inset 0 0 0 1px rgba(255,255,255,0.6);'}
    }
    .doc-brand { display: flex; align-items: center; justify-content: space-between; padding: 2px 4px 12px; margin-bottom: 10px; border-bottom: 1px dashed ${t.border}; }
    .doc-brand-title { font-weight: 650; font-size: 14px; letter-spacing: -0.01em; color: ${t.headingFg}; }
    .doc-brand-sub { margin-top: 2px; font-size: 11px; color: ${t.mutedFg}; letter-spacing: 0.02em; }
    .toc-title { font-weight: 650; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: ${t.mutedFg}; margin: 2px 4px 10px; }
    .toc-list { list-style: none; padding: 0 4px 8px 0; margin: 0; display: grid; gap: 3px; overflow: auto; min-height: 0; }
    .toc-item a {
      position: relative;
      display: block;
      text-decoration: none;
      border-radius: 10px;
      padding: 7px 10px 7px 12px;
      line-height: 1.35;
      color: ${isDark ? '#d4d4d8' : '#18181b'};
      font-size: 13.5px;
      transition: background 140ms ease, color 140ms ease;
    }
    .toc-item a:hover { background: ${isDark ? 'rgba(39,39,42,0.55)' : 'rgba(244,244,245,0.90)'}; color: ${t.headingFg}; text-decoration: none; }
    .toc-item a::before { content: ""; position: absolute; left: 0; top: 18%; bottom: 18%; width: 2px; border-radius: 9999px; background: transparent; }
    .toc-l1 { font-weight: 600; }
    .toc-l1 > a { margin-top: 6px; color: ${t.headingFg}; font-size: 14px; }
    .toc-l1:first-child > a { margin-top: 0; }
    .toc-list > li:first-child[class*="toc-l2"] { padding-left: 0; }
    .toc-list > li:first-child[class*="toc-l3"] { padding-left: 0; }
    .toc-list > li:first-child[class*="toc-l4"] { padding-left: 0; }
    .toc-l2 { padding-left: 14px; }
    .toc-l2 > a { color: ${isDark ? '#d4d4d8' : '#18181b'}; font-size: 13px; }
    .toc-l2 > a::before { background: linear-gradient(180deg, rgba(99,102,241,0.25), rgba(217,70,239,0.18)); opacity: 0.9; }
    .toc-l3 { padding-left: 28px; }
    .toc-l3 > a { color: ${t.mutedFg}; font-size: 12.5px; }
    .toc-l4 { padding-left: 44px; }
    .toc-l4 > a { color: ${t.mutedFg}; font-size: 12px; opacity: 0.95; }

    /* Content area card */
    .doc-shell {
      background: ${t.panelBg};
      border: 1px solid ${t.strongBorder};
      border-radius: 22px;
      padding: 40px 44px 48px;
      ${isDark
        ? 'box-shadow: 0 0 0 1px rgba(39,39,42,0.35), 0 20px 60px -30px rgba(0,0,0,0.75);'
        : 'box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 10px 30px -20px rgba(0,0,0,0.15);'}
    }
    @media (max-width: 640px) { .doc-shell { padding: 26px 18px 36px; border-radius: 18px; } }
    .doc-hero {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
      padding: 14px 16px; margin: -4px 0 24px;
      border: 1px solid ${t.border};
      background: ${t.panelBgAlt};
      border-radius: 16px;
    }
    .doc-hero-main { min-width: 0; }
    .doc-hero-crumb { font-size: 12px; color: ${t.mutedFg}; letter-spacing: 0.02em; margin-bottom: 6px; }
    .doc-hero-title { margin: 0; font-size: 28px; line-height: 1.2; }
    .doc-hero-badge {
      flex-shrink: 0;
      font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
      padding: 6px 10px;
      border-radius: 9999px;
      border: 1px solid ${t.strongBorder};
      color: ${t.mutedFg};
      background: ${isDark ? 'rgba(39,39,42,0.70)' : 'rgba(255,255,255,0.85)'};
    }

    /* Inline code */
    .inline-code {
      background: ${t.codeInBg};
      border: 1px solid ${t.border};
      color: ${t.codeInFg};
      border-radius: 8px;
      padding: 1px 6px;
      font-size: 0.9em;
      font-weight: 500;
      box-shadow: ${isDark ? 'inset 0 0 0 1px rgba(63,63,70,0.25)' : '0 1px 0 rgba(0,0,0,0.02)'};
    }

    /* Blockquote */
    blockquote {
      margin: 20px 0;
      padding: 12px 16px;
      border-left: 4px solid ${t.quoteBorder};
      border-radius: 0 14px 14px 0;
      background: ${t.quoteBg};
      color: ${isDark ? '#e4e4e7' : '#18181b'};
      ${isDark ? 'box-shadow: inset -1px 0 0 rgba(63,63,70,0.35);' : ''}
    }
    blockquote > :first-child { margin-top: 0; }
    blockquote > :last-child { margin-bottom: 0; }

    /* Tables */
    table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 18px 0; font-size: 13.5px; border: 1px solid ${t.strongBorder}; border-radius: 14px; overflow: hidden; background: ${t.panelBg};
      box-shadow: ${isDark ? '0 0 0 1px rgba(39,39,42,0.35)' : '0 1px 2px rgba(0,0,0,0.04)'}; }
    thead th {
      background: ${t.tableHdBg};
      border-bottom: 1px solid ${t.strongBorder};
      text-align: left;
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: ${isDark ? '#e4e4e7' : '#374151'};
    }
    tbody td {
      border-bottom: 1px solid ${t.border};
      padding: 10px 14px;
      vertical-align: top;
      color: ${isDark ? '#d4d4d8' : '#27272a'};
    }
    tbody tr:last-child td { border-bottom: 0; }
    tbody tr:nth-child(even) td { background: ${t.trBg}; }

    /* Code block window — same visual as runtime DocContent */
    .export-code {
      position: relative;
      margin: 20px 0;
      border: 1px solid ${t.strongBorder};
      border-radius: 16px;
      overflow: hidden;
      background: ${isDark ? '#18181b' : '#ffffff'};
      box-shadow: ${isDark
        ? '0 0 0 1px rgba(63,63,70,0.25), 0 10px 30px -12px rgba(0,0,0,0.6)'
        : '0 1px 2px rgba(0,0,0,0.04)'};
    }
    .export-code-hd {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 10px 14px;
      border-bottom: 1px solid ${t.strongBorder};
      background: ${t.codeHdBg};
    }
    .export-code-hd-left { display: flex; align-items: center; gap: 10px; }
    .export-code-dots { display: inline-flex; align-items: center; gap: 6px; }
    .export-code-dots i { display: inline-block; width: 10px; height: 10px; border-radius: 9999px; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08); opacity: 0.9; }
    .export-code-dots i:nth-child(1) { background: #fca5a5; }
    .export-code-dots i:nth-child(2) { background: #fcd34d; }
    .export-code-dots i:nth-child(3) { background: #86efac; }
    .export-code-lang { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; color: ${t.mutedFg}; }
    .export-code-lang-badge {
      margin-left: auto;
      padding: 3px 8px;
      border-radius: 9999px;
      border: 1px solid ${t.border};
      font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
      color: ${t.mutedFg};
      background: ${isDark ? 'rgba(24,24,27,0.7)' : 'rgba(255,255,255,0.9)'};
    }
    .export-code-body { overflow-x: auto; background: ${isDark ? 'rgba(24,24,27,0.92)' : '#ffffff'}; }
    pre.export-code-pre {
      margin: 0;
      padding: 14px 16px;
      background: transparent !important;
      color: ${t.codeFg};
      font-size: 13px;
      line-height: 1.65;
      border-radius: 0;
      white-space: pre;
      overflow-x: auto;
    }
    pre.export-code-pre code { background: transparent !important; color: inherit; padding: 0; }

    /* HLJS tuned tokens (light & dark aligned with runtime) */
    .hljs { background: transparent; padding: 0; color: ${t.codeFg}; }
    .hljs-keyword, .hljs-literal, .hljs-symbol, .hljs-bullet, .hljs-link, .hljs-meta-keyword, .hljs-selector-id, .hljs-type, .hljs-built_in { color: ${t.hlKeyword}; }
    .hljs-string, .hljs-regexp, .hljs-addition, .hljs-meta-string { color: ${t.hlString}; }
    .hljs-attr, .hljs-attribute { color: ${t.hlAttr}; }
    .hljs-number, .hljs-variable, .hljs-template-variable, .hljs-class .hljs-title, .hljs-params, .hljs-link_label, .hljs-selector-attr, .hljs-selector-pseudo { color: ${t.hlNumber}; }
    .hljs-comment, .hljs-code, .hljs-quote { color: ${t.hlComment}; }
    .hljs-title, .hljs-section, .hljs-selector-tag, .hljs-doctag, .hljs-name, .hljs-strong { color: ${t.hlTitle}; }

    /* Mermaid diagram window */
    .export-mermaid {
      position: relative;
      margin: 20px 0;
      border: 1px solid ${t.strongBorder};
      border-radius: 16px;
      overflow: hidden;
      background: ${isDark ? 'linear-gradient(180deg,rgba(39,39,42,0.7),rgba(24,24,27,0.5))' : 'linear-gradient(180deg,#fafafa,#ffffff)'};
      box-shadow: ${isDark
        ? '0 0 0 1px rgba(63,63,70,0.25), 0 10px 30px -12px rgba(0,0,0,0.6)'
        : '0 1px 2px rgba(0,0,0,0.04)'};
    }
    .export-mermaid-header {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 10px 14px;
      border-bottom: 1px solid ${t.strongBorder};
      background: ${t.codeHdBg};
    }
    .export-mermaid-header-left { display: flex; align-items: center; gap: 10px; }
    .export-mermaid-dots { display: inline-flex; align-items: center; gap: 6px; }
    .export-mermaid-dots i { display: inline-block; width: 10px; height: 10px; border-radius: 9999px; opacity: 0.9; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08); }
    .export-mermaid-dots i:nth-child(1) { background: #fca5a5; }
    .export-mermaid-dots i:nth-child(2) { background: #fcd34d; }
    .export-mermaid-dots i:nth-child(3) { background: #86efac; }
    .export-mermaid-lang {
      font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
      color: ${t.mutedFg};
    }
    .export-mermaid-lang-badge {
      margin-left: auto;
      padding: 3px 8px;
      border-radius: 9999px;
      border: 1px solid ${t.border};
      font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
      color: ${t.mutedFg};
      background: ${isDark ? 'rgba(24,24,27,0.7)' : 'rgba(255,255,255,0.9)'};
    }
    .export-mermaid-body {
      padding: 22px 24px;
      overflow-x: auto;
      background: ${isDark ? 'rgba(24,24,27,0.35)' : 'rgba(255,255,255,0.7)'};
    }
    .export-mermaid-body svg { height: auto !important; max-width: 100% !important; display: block; margin: 0 auto; }
    .export-mermaid-error .export-mermaid-body { padding: 16px 18px; }
    .mermaid-error-title {
      display: inline-flex; align-items: center; gap: 8px;
      color: ${isDark ? '#fb7185' : '#dc2626'};
      font-weight: 650;
      font-size: 14px;
      margin-bottom: 10px;
    }
    .mermaid-error-pre {
      margin: 8px 0 10px;
      padding: 12px 14px;
      background: ${isDark ? 'rgba(24,24,27,0.75)' : 'rgba(250,250,250,0.95)'};
      border: 1px solid ${t.strongBorder};
      border-radius: 12px;
      font-size: 12.5px;
      line-height: 1.65;
      overflow-x: auto;
      color: ${isDark ? '#e4e4e7' : '#18181b'};
      white-space: pre;
    }
    .mermaid-error-src {
      margin-top: 10px;
      padding: 10px 14px;
      border: 1px solid ${t.strongBorder};
      border-radius: 12px;
      background: ${t.panelBg};
      font-size: 12px;
      color: ${isDark ? '#d4d4d8' : '#27272a'};
    }
    .mermaid-error-src summary { cursor: pointer; font-weight: 600; font-size: 12.5px; color: ${t.headingFg}; }
    .mermaid-error-src pre { margin: 8px 0 0; padding: 0; background: transparent; color: inherit; border-radius: 0; font-size: 12px; }

    @media print {
      @page { margin: 14mm; }
      html, body { background: #ffffff !important; color: #000000 !important; }
      .toc { position: static !important; max-height: none !important; border: 1px solid #e4e4e7 !important; background: #ffffff !important; }
      .doc-shell { border: 1px solid #e4e4e7 !important; background: #ffffff !important; padding: 0 !important; box-shadow: none !important; }
      .doc-hero { padding: 0 0 18px !important; border: 0 !important; background: transparent !important; }
      .doc-hero-badge { display: none !important; }
      a { color: #000000 !important; text-decoration: none !important; }
      .export-code, .export-mermaid { page-break-inside: avoid; break-inside: avoid; box-shadow: none !important; }
      pre.export-code-pre, .mermaid-error-pre, blockquote, table, th, td { background: #ffffff !important; color: #000000 !important; }
      thead th { background: #f4f4f5 !important; color: #111827 !important; }
      tbody tr:nth-child(even) td { background: #fafafa !important; }
      blockquote { border-left-color: #e4e4e7 !important; }
      .hljs, .hljs * { color: #111827 !important; }
      .hljs-keyword, .hljs-literal, .hljs-symbol { color: #7c3aed !important; }
      .hljs-string, .hljs-regexp { color: #b45309 !important; }
      .hljs-attr { color: #1d4ed8 !important; }
      .hljs-number { color: #a16207 !important; }
      .hljs-comment, .hljs-quote { color: #6b7280 !important; }
    }
  `

  const body = renderToStaticMarkup(
    <div className="page-shell">
      <div className="page">
        <aside>{renderToc(params.toc)}</aside>
        <main>
          <section className="doc-shell">
            <div className="doc-hero">
              <div className="doc-hero-main">
                <div className="doc-hero-crumb">API Docs · {isDark ? 'Dark Theme' : 'Light Theme'} · Static Export</div>
                <h1 className="doc-hero-title">{params.title || '文档'}</h1>
              </div>
              <div className="doc-hero-badge">{isDark ? 'Dark' : 'Light'}</div>
            </div>
            {renderContent(params.raw, mermaidMap)}
          </section>
        </main>
      </div>
    </div>,
  )

  const title = params.title.trim() || '文档'
  const fileName = sanitizeFileName(title) || '文档'

  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>${css}</style>
  </head>
  <body>
    ${body}
  </body>
</html>`

  return { html, fileName }
}

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
