import { useFile } from "@/context/file"
import { ContextMenu } from "@opencode-ai/ui/context-menu"
import { useServer } from "@/context/server"
import { showPromiseToast } from "@opencode-ai/ui/toast"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { Icon } from "@opencode-ai/ui/icon"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { useParams } from "@solidjs/router"
import { decode64 } from "@/utils/base64"
import {
  createEffect,
  createMemo,
  For,
  Match,
  Show,
  splitProps,
  Switch,
  untrack,
  type ComponentProps,
  type ParentProps,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import type { FileNode } from "@opencode-ai/sdk/v2"

type Kind = "add" | "del" | "mix"

type Filter = {
  files: Set<string>
  dirs: Set<string>
}

export default function FileTree(props: {
  path: string
  class?: string
  nodeClass?: string
  active?: string
  selectedPaths?: ReadonlySet<string>
  onSelectionChange?: (paths: Set<string>) => void
  level?: number
  allowed?: readonly string[]
  modified?: readonly string[]
  kinds?: ReadonlyMap<string, Kind>
  draggable?: boolean
  tooltip?: boolean
  onFileClick?: (file: FileNode) => void

  _filter?: Filter
  _marks?: Set<string>
  _deeps?: Map<string, number>
  _kinds?: ReadonlyMap<string, Kind>
}) {
  const file = useFile()
  const server = useServer()
  const params = useParams()
  const level = props.level ?? 0
  const draggable = () => props.draggable ?? true
  const tooltip = () => props.tooltip ?? true

  const handleUpload = (path: string) => {
    const input = document.createElement("input")
    input.type = "file"
    input.onchange = async (e) => {
      const uploadFile = (e.target as HTMLInputElement).files?.[0]
      if (!uploadFile) return

      const formData = new FormData()
      formData.append("file", uploadFile)

      const promise = async () => {
        const url = new URL("/file/upload", server.url)
        url.searchParams.set("path", path)

        const rootDir = params.dir ? decode64(params.dir) : null
        if (rootDir) {
          url.searchParams.set("directory", rootDir)
        }

        console.log("[FileTree] Uploading to:", url.toString())

        const res = await fetch(url, {
          method: "POST",
          body: formData,
        })

        const contentType = res.headers.get("content-type")
        if (contentType && contentType.includes("text/html")) {
          throw new Error(`Server returned HTML. Check server URL: ${server.url}`)
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.message || "Upload failed")
        }

        await file.tree.refresh(path)
        return "File uploaded successfully"
      }

      showPromiseToast(promise(), {
        loading: "Uploading...",
        success: (msg) => msg,
        error: (err: any) => `Upload failed: ${err.message}`,
      })
    }
    input.click()
  }

  const handleDownload = (path: string) => {
    const url = new URL("/file/download", server.url)
    
    const selected = props.selectedPaths
    const isMultiSelect = selected && selected.has(path) && selected.size > 1

    if (isMultiSelect) {
      for (const p of selected) {
        url.searchParams.append("path", p)
      }
    } else {
      url.searchParams.set("path", path)
    }

    const rootDir = params.dir ? decode64(params.dir) : null
    if (rootDir) {
      url.searchParams.set("directory", rootDir)
    }

    console.log("[FileTree] Download URL:", url.toString())

    const a = document.createElement("a")
    a.href = url.toString()
    a.download = isMultiSelect ? "download.zip" : (path.split("/").pop() ?? "download")
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const filter = createMemo(() => {
    if (props._filter) return props._filter

    const allowed = props.allowed
    if (!allowed) return

    const files = new Set(allowed)
    const dirs = new Set<string>()

    for (const item of allowed) {
      const parts = item.split("/")
      const parents = parts.slice(0, -1)
      for (const [idx] of parents.entries()) {
        const dir = parents.slice(0, idx + 1).join("/")
        if (dir) dirs.add(dir)
      }
    }

    return { files, dirs }
  })

  const marks = createMemo(() => {
    if (props._marks) return props._marks

    const out = new Set<string>()
    for (const item of props.modified ?? []) out.add(item)
    for (const item of props.kinds?.keys() ?? []) out.add(item)
    if (out.size === 0) return
    return out
  })

  const kinds = createMemo(() => {
    if (props._kinds) return props._kinds
    return props.kinds
  })

  const deeps = createMemo(() => {
    if (props._deeps) return props._deeps

    const out = new Map<string, number>()

    const visit = (dir: string, lvl: number): number => {
      const expanded = file.tree.state(dir)?.expanded ?? false
      if (!expanded) return -1

      const nodes = file.tree.children(dir)
      const max = nodes.reduce((max, node) => {
        if (node.type !== "directory") return max
        const open = file.tree.state(node.path)?.expanded ?? false
        if (!open) return max
        return Math.max(max, visit(node.path, lvl + 1))
      }, lvl)

      out.set(dir, max)
      return max
    }

    visit(props.path, level - 1)
    return out
  })

  createEffect(() => {
    const current = filter()
    if (!current) return
    if (level !== 0) return

    for (const dir of current.dirs) {
      const expanded = untrack(() => file.tree.state(dir)?.expanded) ?? false
      if (expanded) continue
      file.tree.expand(dir)
    }
  })

  createEffect(() => {
    const path = props.path
    untrack(() => void file.tree.list(path))
  })

  const nodes = createMemo(() => {
    const nodes = file.tree.children(props.path)
    const current = filter()
    if (!current) return nodes

    const parent = (path: string) => {
      const idx = path.lastIndexOf("/")
      if (idx === -1) return ""
      return path.slice(0, idx)
    }

    const leaf = (path: string) => {
      const idx = path.lastIndexOf("/")
      return idx === -1 ? path : path.slice(idx + 1)
    }

    const out = nodes.filter((node) => {
      if (node.type === "file") return current.files.has(node.path)
      return current.dirs.has(node.path)
    })

    const seen = new Set(out.map((node) => node.path))

    for (const dir of current.dirs) {
      if (parent(dir) !== props.path) continue
      if (seen.has(dir)) continue
      out.push({
        name: leaf(dir),
        path: dir,
        absolute: dir,
        type: "directory",
        ignored: false,
      })
      seen.add(dir)
    }

    for (const item of current.files) {
      if (parent(item) !== props.path) continue
      if (seen.has(item)) continue
      out.push({
        name: leaf(item),
        path: item,
        absolute: item,
        type: "file",
        ignored: false,
      })
      seen.add(item)
    }

    return out.toSorted((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  })

  const Node = (
    p: ParentProps &
      ComponentProps<"div"> &
      ComponentProps<"button"> & {
        node: FileNode
        as?: "div" | "button"
      },
  ) => {
    const [local, rest] = splitProps(p, ["node", "as", "children", "class", "classList", "onClick"])
    
    const handleNodeClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault()
        e.stopPropagation()
        if (props.onSelectionChange) {
          const next = new Set(props.selectedPaths)
          if (next.has(local.node.path)) {
            next.delete(local.node.path)
          } else {
            next.add(local.node.path)
          }
          props.onSelectionChange(next)
        }
        return
      }

      // If selection exists but no modifier key, clear selection (except current if needed)
      // But we also want to trigger the normal onClick (open file or toggle dir)
      // The parent component passing onClick (for file) handles opening.
      // We should probably clear other selections here.
      if (props.onSelectionChange && props.selectedPaths?.size) {
          // If we are clicking a file/dir, we might want to select just this one?
          // Usually file tree behavior: Click -> Selects this one (clears others)
          // If we don't clear, previous multi-selections remain active which is confusing.
          props.onSelectionChange(new Set([local.node.path]))
      }
      
      if (typeof local.onClick === "function") {
         ;(local.onClick as (e: MouseEvent) => void)(e)
       } else if (Array.isArray(local.onClick)) {
         ;(local.onClick[0] as (data: any, e: MouseEvent) => void)(local.onClick[1], e)
       }
     }
 
     return (
      <ContextMenu>
        <ContextMenu.Trigger asChild>
          <Dynamic
            component={local.as ?? "div"}
            data-file-node
            classList={{
              "w-full min-w-0 h-6 flex items-center justify-start gap-x-1.5 rounded-md px-1.5 py-0 text-left hover:bg-surface-raised-base-hover active:bg-surface-base-active transition-colors cursor-pointer": true,
              "bg-surface-base-active": local.node.path === props.active || props.selectedPaths?.has(local.node.path),
              ...(local.classList ?? {}),
              [local.class ?? ""]: !!local.class,
              [props.nodeClass ?? ""]: !!props.nodeClass,
            }}
            style={`padding-left: ${Math.max(0, 8 + level * 12 - (local.node.type === "file" ? 24 : 4))}px`}
            draggable={draggable()}
            onDragStart={(e: DragEvent) => {
              if (!draggable()) return
              e.dataTransfer?.setData("text/plain", `file:${local.node.path}`)
              e.dataTransfer?.setData("text/uri-list", `file://${local.node.path}`)
              if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy"

              const dragImage = document.createElement("div")
              dragImage.className =
                "flex items-center gap-x-2 px-2 py-1 bg-surface-raised-base rounded-md border border-border-base text-12-regular text-text-strong"
              dragImage.style.position = "absolute"
              dragImage.style.top = "-1000px"

              const icon =
                (e.currentTarget as HTMLElement).querySelector('[data-component="file-icon"]') ??
                (e.currentTarget as HTMLElement).querySelector("svg")
              const text = (e.currentTarget as HTMLElement).querySelector("span")
              if (icon && text) {
                dragImage.innerHTML = (icon as SVGElement).outerHTML + (text as HTMLSpanElement).outerHTML
              }

              document.body.appendChild(dragImage)
              e.dataTransfer?.setDragImage(dragImage, 0, 12)
              setTimeout(() => document.body.removeChild(dragImage), 0)
            }}
            onClick={handleNodeClick}
            {...rest}
          >
            {local.children}
            {(() => {
              const kind = kinds()?.get(local.node.path)
              const marked = marks()?.has(local.node.path) ?? false
              const active = !!kind && marked && !local.node.ignored
              const color =
                kind === "add"
                  ? "color: var(--icon-diff-add-base)"
                  : kind === "del"
                    ? "color: var(--icon-diff-delete-base)"
                    : kind === "mix"
                      ? "color: var(--icon-diff-modified-base)"
                      : undefined
              return (
                <span
                  classList={{
                    "flex-1 min-w-0 text-12-medium whitespace-nowrap truncate": true,
                    "text-text-weaker": local.node.ignored,
                    "text-text-weak": !local.node.ignored && !active,
                  }}
                  style={active ? color : undefined}
                >
                  {local.node.name}
                </span>
              )
            })()}
            {(() => {
              const kind = kinds()?.get(local.node.path)
              if (!kind) return null
              if (!marks()?.has(local.node.path)) return null

              if (local.node.type === "file") {
                const text = kind === "add" ? "A" : kind === "del" ? "D" : "M"
                const color =
                  kind === "add"
                    ? "color: var(--icon-diff-add-base)"
                    : kind === "del"
                      ? "color: var(--icon-diff-delete-base)"
                      : "color: var(--icon-diff-modified-base)"

                return (
                  <span class="shrink-0 w-4 text-center text-12-medium" style={color}>
                    {text}
                  </span>
                )
              }

              if (local.node.type === "directory") {
                const color =
                  kind === "add"
                    ? "background-color: var(--icon-diff-add-base)"
                    : kind === "del"
                      ? "background-color: var(--icon-diff-delete-base)"
                      : "background-color: var(--icon-diff-modified-base)"

                return <div class="shrink-0 size-1.5 mr-1.5 rounded-full" style={color} />
              }

              return null
            })()}
          </Dynamic>
        </ContextMenu.Trigger>
        <ContextMenu.Content class="min-w-48">
          <Show when={local.node.type === "directory"}>
            <ContextMenu.Item onSelect={() => handleUpload(local.node.path)}>
              <div class="flex items-center gap-2">
                <Icon name="cloud-upload" size="small" />
                <span>Upload File...</span>
              </div>
            </ContextMenu.Item>
            <ContextMenu.Item onSelect={() => handleDownload(local.node.path)}>
              <div class="flex items-center gap-2">
                <Icon name="download" size="small" />
                <span>
                  {props.selectedPaths?.has(local.node.path) && (props.selectedPaths?.size ?? 0) > 1
                    ? "Download Selected"
                    : "Download as Zip"}
                </span>
              </div>
            </ContextMenu.Item>
          </Show>
          <Show when={local.node.type === "file"}>
            <ContextMenu.Item onSelect={() => handleDownload(local.node.path)}>
              <div class="flex items-center gap-2">
                <Icon name="download" size="small" />
                <span>
                  {props.selectedPaths?.has(local.node.path) && (props.selectedPaths?.size ?? 0) > 1
                    ? "Download Selected"
                    : "Download"}
                </span>
              </div>
            </ContextMenu.Item>
          </Show>
        </ContextMenu.Content>
      </ContextMenu>
    )
  }

  return (
    <div class={`flex flex-col gap-0.5 ${props.class ?? ""}`}>
      <For each={nodes()}>
        {(node) => {
          const expanded = () => file.tree.state(node.path)?.expanded ?? false
          const deep = () => deeps().get(node.path) ?? -1
          const Wrapper = (p: ParentProps) => {
            if (!tooltip()) return p.children

            const parts = node.path.split("/")
            const leaf = parts[parts.length - 1] ?? node.path
            const head = parts.slice(0, -1).join("/")
            const prefix = head ? `${head}/` : ""

            const kind = () => kinds()?.get(node.path)
            const label = () => {
              const k = kind()
              if (!k) return
              if (k === "add") return "Additions"
              if (k === "del") return "Deletions"
              return "Modifications"
            }

            const ignored = () => node.type === "directory" && node.ignored

            return (
              <Tooltip
                openDelay={2000}
                placement="bottom-start"
                class="w-full"
                contentStyle={{ "max-width": "480px", width: "fit-content" }}
                value={
                  <div class="flex items-center min-w-0 whitespace-nowrap text-12-regular">
                    <span
                      class="min-w-0 truncate text-text-invert-base"
                      style={{ direction: "rtl", "unicode-bidi": "plaintext" }}
                    >
                      {prefix}
                    </span>
                    <span class="shrink-0 text-text-invert-strong">{leaf}</span>
                    <Show when={label()}>
                      {(t: () => string) => (
                        <>
                          <span class="mx-1 font-bold text-text-invert-strong">•</span>
                          <span class="shrink-0 text-text-invert-strong">{t()}</span>
                        </>
                      )}
                    </Show>
                    <Show when={ignored()}>
                      <>
                        <span class="mx-1 font-bold text-text-invert-strong">•</span>
                        <span class="shrink-0 text-text-invert-strong">Ignored</span>
                      </>
                    </Show>
                  </div>
                }
              >
                {p.children}
              </Tooltip>
            )
          }

          return (
            <Switch>
              <Match when={node.type === "directory"}>
                <Collapsible
                  variant="ghost"
                  class="w-full"
                  data-scope="filetree"
                  forceMount={false}
                  open={expanded()}
                  onOpenChange={(open) => (open ? file.tree.expand(node.path) : file.tree.collapse(node.path))}
                >
                  <Collapsible.Trigger>
                    <Wrapper>
                      <Node node={node}>
                        <div class="size-4 flex items-center justify-center text-icon-weak">
                          <Icon name={expanded() ? "chevron-down" : "chevron-right"} size="small" />
                        </div>
                      </Node>
                    </Wrapper>
                  </Collapsible.Trigger>
                  <Collapsible.Content class="relative pt-0.5">
                    <div
                      classList={{
                        "absolute top-0 bottom-0 w-px pointer-events-none bg-border-weak-base opacity-0 transition-opacity duration-150 ease-out motion-reduce:transition-none": true,
                        "group-hover/filetree:opacity-100": expanded() && deep() === level,
                        "group-hover/filetree:opacity-50": !(expanded() && deep() === level),
                      }}
                      style={`left: ${Math.max(0, 8 + level * 12 - 4) + 8}px`}
                    />
                    <FileTree
                      path={node.path}
                      level={level + 1}
                      allowed={props.allowed}
                      modified={props.modified}
                      kinds={props.kinds}
                      active={props.active}
                      selectedPaths={props.selectedPaths}
                      onSelectionChange={props.onSelectionChange}
                      draggable={props.draggable}
                      tooltip={props.tooltip}
                      onFileClick={props.onFileClick}
                      _filter={filter()}
                      _marks={marks()}
                      _deeps={deeps()}
                      _kinds={kinds()}
                    />
                  </Collapsible.Content>
                </Collapsible>
              </Match>
              <Match when={node.type === "file"}>
                <Wrapper>
                  <Node node={node} as="button" type="button" onClick={() => props.onFileClick?.(node)}>
                    <div class="w-4 shrink-0" />
                    <FileIcon node={node} class="text-icon-weak size-4" />
                  </Node>
                </Wrapper>
              </Match>
            </Switch>
          )
        }}
      </For>
    </div>
  )
}
