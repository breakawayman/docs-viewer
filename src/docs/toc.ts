import GithubSlugger from 'github-slugger'

export type TocItem = {
  id: string
  text: string
  level: 1 | 2 | 3 | 4
  children: TocItem[]
}

function normalizeHeadingText(input: string) {
  return input.replace(/\s+#+\s*$/, '').trim()
}

export function buildTocFromMarkdown(raw: string): TocItem[] {
  const slugger = new GithubSlugger()

  const lines = raw.split(/\r?\n/)
  let inFence = false

  const items: Array<{ level: 1 | 2 | 3 | 4; text: string; id: string }> = []

  for (const line of lines) {
    const fence = line.trim()
    if (fence.startsWith('```') || fence.startsWith('~~~')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const match = /^(#{1,4})\s+(.*)$/.exec(line)
    if (!match) continue

    const level = match[1].length as 1 | 2 | 3 | 4
    const text = normalizeHeadingText(match[2])
    if (!text) continue

    const id = slugger.slug(text)
    items.push({ level, text, id })
  }

  const root: TocItem[] = []
  const stack: TocItem[] = []

  for (const it of items) {
    const node: TocItem = { id: it.id, text: it.text, level: it.level, children: [] }

    // 弹出所有层级 >= 当前节点层级的栈元素（保证栈顶是最近的祖先）
    while (stack.length > 0 && stack[stack.length - 1].level >= it.level) {
      stack.pop()
    }

    if (stack.length === 0) {
      root.push(node)
    } else {
      stack[stack.length - 1].children.push(node)
    }

    stack.push(node)
  }

  return root
}

