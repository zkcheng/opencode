import { For, Match, Show, Switch, createEffect, createMemo, createSignal, onCleanup, on, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { Dynamic } from "solid-js/web"
import { useParams } from "@solidjs/router"
import { DragDropProvider, DragDropSensors, DragOverlay, SortableProvider, closestCenter } from "@thisbeyond/solid-dnd"
import type { DragEvent } from "@thisbeyond/solid-dnd"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { Tabs } from "@opencode-ai/ui/tabs"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { LineComment as LineCommentView, LineCommentEditor } from "@opencode-ai/ui/line-comment"
import { Mark } from "@opencode-ai/ui/logo"
import { ContextMenu } from "@opencode-ai/ui/context-menu"
import { useCodeComponent } from "@opencode-ai/ui/context/code"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { showPromiseToast, showToast } from "@opencode-ai/ui/toast"
import { useFile, selectionFromLines, type FileSelection, type SelectedLineRange } from "@/context/file"
import { useLayout } from "@/context/layout"
import { useSDK } from "@/context/sdk"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { usePrompt } from "@/context/prompt"
import { useComments } from "@/context/comments"
import { useServer } from "@/context/server"
import { DialogSelectFile } from "@/components/dialog-select-file"
import FileTree from "@/components/file-tree"
import { SortableTab, FileVisual } from "@/components/session"
import { ConstrainDragYAxis, getDraggableId } from "@/utils/solid-dnd"
import { checksum, base64Encode } from "@opencode-ai/util/encode"
import { decode64 } from "@/utils/base64"
import { marked } from "marked"
import { same } from "@/utils/same"

interface WorkspacePanelProps {
  class?: string
}

function StickyAddButton(props: { children: JSX.Element }) {
  const [stuck, setStuck] = createSignal(false)
  let button: HTMLDivElement | undefined

  createEffect(() => {
    const node = button
    if (!node) return

    const scroll = node.parentElement
    if (!scroll) return

    const handler = () => {
      const rect = node.getBoundingClientRect()
      const scrollRect = scroll.getBoundingClientRect()
      setStuck(rect.right >= scrollRect.right && scroll.scrollWidth > scroll.clientWidth)
    }

    scroll.addEventListener("scroll", handler, { passive: true })
    const observer = new ResizeObserver(handler)
    observer.observe(scroll)
    handler()
    onCleanup(() => {
      scroll.removeEventListener("scroll", handler)
      observer.disconnect()
    })
  })

  return (
    <div
      ref={button}
      class="bg-background-base h-full shrink-0 sticky right-0 z-10 flex items-center justify-center border-b border-border-weak-base px-3"
      classList={{ "border-l": stuck() }}
    >
      {props.children}
    </div>
  )
}

export function WorkspacePanel(props: WorkspacePanelProps) {
  const layout = useLayout()
  const file = useFile()
  const sdk = useSDK()
  const dialog = useDialog()
  const command = useCommand()
  const language = useLanguage()
  const platform = usePlatform()
  const prompt = usePrompt()
  const comments = useComments()
  const server = useServer()
  const codeComponent = useCodeComponent()
  const params = useParams()
  const [selectedPaths, setSelectedPaths] = createSignal(new Set<string>())
  const [store, setStore] = createStore({
    activeDraggable: undefined as string | undefined,
  })

  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const tabs = createMemo(() => layout.tabs(sessionKey))
  const view = createMemo(() => layout.view(sessionKey))

  function normalizeTab(tab: string) {
    if (!tab.startsWith("file://")) return tab
    return file.tab(tab)
  }

  function normalizeTabs(list: string[]) {
    const seen = new Set<string>()
    const next: string[] = []
    for (const item of list) {
      const value = normalizeTab(item)
      if (seen.has(value)) continue
      seen.add(value)
      next.push(value)
    }
    return next
  }

  const openTab = (value: string) => {
    const next = normalizeTab(value)
    tabs().open(next)

    const path = file.pathFromTab(next)
    if (path) file.load(path)
  }

  createEffect(() => {
    const active = tabs().active()
    if (!active) return

    const path = file.pathFromTab(active)
    if (path) file.load(path)
  })

  createEffect(() => {
    const current = tabs().all()
    if (current.length === 0) return

    const next = normalizeTabs(current)
    if (same(current, next)) return

    tabs().setAll(next)

    const active = tabs().active()
    if (!active) return
    if (!active.startsWith("file://")) return

    const normalized = normalizeTab(active)
    if (active === normalized) return
    tabs().setActive(normalized)
  })

  const openedTabs = createMemo(() => tabs().all())
  const hasPreview = createMemo(() => openedTabs().length > 0)

  const activeTab = createMemo(() => {
    const active = tabs().active()
    if (active && file.pathFromTab(active)) return normalizeTab(active)
    const first = openedTabs()[0]
    if (first) return first
    return "empty"
  })

  createEffect(() => {
    if (!layout.ready()) return
    if (tabs().active()) return
    if (openedTabs().length === 0) return

    const next = activeTab()
    if (next === "empty") return
    tabs().setActive(next)
  })

  const handleDragStart = (event: unknown) => {
    const id = getDraggableId(event)
    if (!id) return
    setStore("activeDraggable", id)
  }

  const handleDragOver = (event: DragEvent) => {
    const { draggable, droppable } = event
    if (!draggable || !droppable) return
    const currentTabs = tabs().all()
    const fromIndex = currentTabs?.indexOf(draggable.id.toString())
    const toIndex = currentTabs?.indexOf(droppable.id.toString())
    if (fromIndex !== toIndex && toIndex !== undefined) {
      tabs().move(draggable.id.toString(), toIndex)
    }
  }

  const handleDragEnd = () => {
    setStore("activeDraggable", undefined)
  }

  const handleRootUpload = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.onchange = async (e) => {
      const uploadFile = (e.target as HTMLInputElement).files?.[0]
      if (!uploadFile) return

      const formData = new FormData()
      formData.append("file", uploadFile)

      const promise = async () => {
        const url = new URL("/file/upload", server.url)
        url.searchParams.set("path", "")

        const rootDir = params.dir ? decode64(params.dir) : null
        if (rootDir) {
          url.searchParams.set("directory", rootDir)
        }

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

        await file.tree.refresh("")
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

  const selectionPreview = (path: string, selection: FileSelection) => {
    const content = file.get(path)?.content?.content
    if (!content) return undefined
    const start = Math.max(1, Math.min(selection.startLine, selection.endLine))
    const end = Math.max(selection.startLine, selection.endLine)
    const lines = content.split("\n").slice(start - 1, end)
    if (lines.length === 0) return undefined
    return lines.slice(0, 2).join("\n")
  }

  const addCommentToContext = (input: {
    file: string
    selection: SelectedLineRange
    comment: string
    preview?: string
  }) => {
    const selection = selectionFromLines(input.selection)
    const preview = input.preview ?? selectionPreview(input.file, selection)
    const saved = comments.add({
      file: input.file,
      selection: input.selection,
      comment: input.comment,
    })
    prompt.context.add({
      type: "file",
      path: input.file,
      selection,
      comment: input.comment,
      commentID: saved.id,
      commentOrigin: "file",
      preview,
    })
  }

  const fileTreeTab = () => layout.fileTree.tab()

  const setFileTreeTabValue = (value: string) => {
    if (value !== "changes" && value !== "all") return
    layout.fileTree.setTab(value)
    if (value === "all") {
      file.tree.refresh("")
    }
  }

  createEffect(() => {
    if (!layout.fileTree.opened()) return
    fileTreeTab()
    void file.tree.list("")
  })

  const previewWidth = createMemo(() => {
    if (!hasPreview()) return 0
    // 动态计算预览宽度：如果屏幕较小，减少预览宽度以保证文件树可见
    const screenWidth = window.innerWidth
    // 预留空间：侧边栏(280px) + 聊天栏(最小400px) + 文件树(layout.fileTree.width())
    const reserved = 280 + 400 + (layout.fileTree.opened() ? layout.fileTree.width() : 0)
    const available = screenWidth - reserved
    
    // 目标宽度 600px，但不超过可用空间的 50% 或剩余空间的 80%
    const target = 600
    const max = Math.max(300, Math.min(target, available * 0.8))
    
    return max
  })

  const containerWidth = createMemo(() => {
    let width = 0
    if (layout.fileTree.opened()) {
      width += layout.fileTree.width()
    }
    width += previewWidth()
    return `${width}px`
  })

  return (
    <aside
      class={`relative flex h-full bg-background-base ${props.class ?? ""}`}
      style={{ width: containerWidth() }}
    >
      <div class="flex-1 min-w-0 h-full flex">
        <Show when={hasPreview()}>
          <div 
            class="flex-1 min-w-0 h-full shrink-0 border-r border-border-weak-base"
            style={{ width: `${previewWidth()}px` }}
          >
            <DragDropProvider
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              collisionDetector={closestCenter}
            >
              <DragDropSensors />
              <ConstrainDragYAxis />
              <Tabs value={activeTab()} onChange={openTab}>
                <div class="sticky top-0 shrink-0 flex">
                  <Tabs.List
                    ref={(el: HTMLDivElement) => {
                      let scrollTimeout: number | undefined
                      let prevScrollWidth = el.scrollWidth

                      const handler = () => {
                        if (scrollTimeout !== undefined) clearTimeout(scrollTimeout)
                        scrollTimeout = window.setTimeout(() => {
                          const scrollWidth = el.scrollWidth
                          const clientWidth = el.clientWidth

                          if (scrollWidth > prevScrollWidth && scrollWidth > clientWidth) {
                            el.scrollTo({
                              left: scrollWidth - clientWidth,
                              behavior: "smooth",
                            })
                          }

                          prevScrollWidth = scrollWidth
                        }, 0)
                      }

                      const wheelHandler = (e: WheelEvent) => {
                        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                          el.scrollLeft += e.deltaY > 0 ? 50 : -50
                          e.preventDefault()
                        }
                      }

                      el.addEventListener("wheel", wheelHandler, { passive: false })

                      const observer = new MutationObserver(handler)
                      observer.observe(el, { childList: true })

                      onCleanup(() => {
                        el.removeEventListener("wheel", wheelHandler)
                        observer.disconnect()
                        if (scrollTimeout !== undefined) clearTimeout(scrollTimeout)
                      })
                    }}
                  >
                    <SortableProvider ids={openedTabs()}>
                      <For each={openedTabs()}>
                        {(tab) => <SortableTab tab={tab} onTabClose={tabs().close} />}
                      </For>
                    </SortableProvider>
                    <StickyAddButton>
                      <TooltipKeybind
                        title={language.t("command.file.open")}
                        keybind={command.keybind("file.open")}
                        class="flex items-center"
                      >
                        <IconButton
                          icon="plus-small"
                          variant="ghost"
                          iconSize="large"
                          onClick={() =>
                            dialog.show(() => <DialogSelectFile mode="files" onOpenFile={() => file.tree.refresh("")} />)
                          }
                          aria-label={language.t("command.file.open")}
                        />
                      </TooltipKeybind>
                    </StickyAddButton>
                  </Tabs.List>
                </div>

                <Tabs.Content value="empty" class="flex flex-col h-full overflow-hidden contain-strict">
                  <Show when={activeTab() === "empty"}>
                    <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
                      <div class="h-full px-6 pb-42 flex flex-col items-center justify-center text-center gap-6">
                        <Mark class="w-14 opacity-10" />
                        <div class="text-14-regular text-text-weak max-w-56">
                          {language.t("session.files.selectToOpen")}
                        </div>
                      </div>
                    </div>
                  </Show>
                </Tabs.Content>

                <For each={openedTabs()}>
                  {(tab) => {
                    let scroll: HTMLDivElement | undefined
                    let scrollFrame: number | undefined
                    let pending: { x: number; y: number } | undefined
                    let codeScroll: HTMLElement[] = []

                    const path = createMemo(() => file.pathFromTab(tab))
                    const state = createMemo(() => {
                      const p = path()
                      if (!p) return
                      return file.get(p)
                    })
                    const contents = createMemo(() => state()?.content?.content ?? "")
                    const cacheKey = createMemo(() => checksum(contents()))
                    const isImage = createMemo(() => {
                      const c = state()?.content
                      return c?.encoding === "base64" && c?.mimeType?.startsWith("image/") && c?.mimeType !== "image/svg+xml"
                    })
                    const isSvg = createMemo(() => {
                      const c = state()?.content
                      return c?.mimeType === "image/svg+xml"
                    })
                    const isHtml = createMemo(() => {
                      const p = path()
                      return p?.endsWith(".html") || p?.endsWith(".htm")
                    })
                    const isMarkdown = createMemo(() => {
                      const p = path()
                      return p?.endsWith(".md") || p?.endsWith(".markdown")
                    })
                    const [previewHtml, setPreviewHtml] = createSignal(false)

                    createEffect(() => {
                      path()
                      setPreviewHtml(false)
                    })

                    const isBinary = createMemo(() => state()?.content?.type === "binary")
                    const svgContent = createMemo(() => {
                      if (!isSvg()) return
                      const c = state()?.content
                      if (!c) return
                      if (c.encoding !== "base64") return c.content
                      return decode64(c.content)
                    })

                    const svgDecodeFailed = createMemo(() => {
                      if (!isSvg()) return false
                      const c = state()?.content
                      if (!c) return false
                      if (c.encoding !== "base64") return false
                      return svgContent() === undefined
                    })

                    const svgToast = { shown: false }
                    createEffect(() => {
                      if (!svgDecodeFailed()) return
                      if (svgToast.shown) return
                      svgToast.shown = true
                      showToast({
                        variant: "error",
                        title: language.t("toast.file.loadFailed.title"),
                        description: "Invalid base64 content.",
                      })
                    })
                    const svgPreviewUrl = createMemo(() => {
                      if (!isSvg()) return
                      const c = state()?.content
                      if (!c) return
                      if (c.encoding === "base64") return `data:image/svg+xml;base64,${c.content}`
                      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(c.content)}`
                    })
                    const imageDataUrl = createMemo(() => {
                      if (!isImage()) return
                      const c = state()?.content
                      return `data:${c?.mimeType};base64,${c?.content}`
                    })
                    const selectedLines = createMemo(() => {
                      const p = path()
                      if (!p) return null
                      return file.selectedLines(p) ?? null
                    })

                    let wrap: HTMLDivElement | undefined

                    const fileComments = createMemo(() => {
                      const p = path()
                      if (!p) return []
                      return comments.list(p)
                    })

                    const commentedLines = createMemo(() => fileComments().map((comment) => comment.selection))

                    const [note, setNote] = createStore({
                      openedComment: null as string | null,
                      commenting: null as SelectedLineRange | null,
                      draft: "",
                      positions: {} as Record<string, number>,
                      draftTop: undefined as number | undefined,
                    })

                    const openedComment = () => note.openedComment
                    const setOpenedComment = (
                      value:
                        | typeof note.openedComment
                        | ((value: typeof note.openedComment) => typeof note.openedComment),
                    ) => setNote("openedComment", value)

                    const commenting = () => note.commenting
                    const setCommenting = (
                      value: typeof note.commenting | ((value: typeof note.commenting) => typeof note.commenting),
                    ) => setNote("commenting", value)

                    const draft = () => note.draft
                    const setDraft = (value: typeof note.draft | ((value: typeof note.draft) => typeof note.draft)) =>
                      setNote("draft", value)

                    const positions = () => note.positions
                    const setPositions = (
                      value: typeof note.positions | ((value: typeof note.positions) => typeof note.positions),
                    ) => setNote("positions", value)

                    const draftTop = () => note.draftTop
                    const setDraftTop = (
                      value: typeof note.draftTop | ((value: typeof note.draftTop) => typeof note.draftTop),
                    ) => setNote("draftTop", value)

                    const commentLabel = (range: SelectedLineRange) => {
                      const start = Math.min(range.start, range.end)
                      const end = Math.max(range.start, range.end)
                      if (start === end) return `line ${start}`
                      return `lines ${start}-${end}`
                    }

                    const getRoot = () => {
                      const el = wrap
                      if (!el) return

                      const host = el.querySelector("diffs-container")
                      if (!(host instanceof HTMLElement)) return

                      const root = host.shadowRoot
                      if (!root) return

                      return root
                    }

                    const findMarker = (root: ShadowRoot, range: SelectedLineRange) => {
                      const line = Math.max(range.start, range.end)
                      const node = root.querySelector(`[data-line="${line}"]`)
                      if (!(node instanceof HTMLElement)) return
                      return node
                    }

                    const markerTop = (wrapper: HTMLElement, marker: HTMLElement) => {
                      const wrapperRect = wrapper.getBoundingClientRect()
                      const rect = marker.getBoundingClientRect()
                      return rect.top - wrapperRect.top + Math.max(0, (rect.height - 20) / 2)
                    }

                    const updateComments = () => {
                      const el = wrap
                      const root = getRoot()
                      if (!el || !root) {
                        setPositions({})
                        setDraftTop(undefined)
                        return
                      }

                      const next: Record<string, number> = {}
                      for (const comment of fileComments()) {
                        const marker = findMarker(root, comment.selection)
                        if (!marker) continue
                        next[comment.id] = markerTop(el, marker)
                      }

                      setPositions(next)

                      const range = commenting()
                      if (!range) {
                        setDraftTop(undefined)
                        return
                      }

                      const marker = findMarker(root, range)
                      if (!marker) {
                        setDraftTop(undefined)
                        return
                      }

                      setDraftTop(markerTop(el, marker))
                    }

                    const scheduleComments = () => {
                      requestAnimationFrame(updateComments)
                    }

                    createEffect(() => {
                      fileComments()
                      scheduleComments()
                    })

                    createEffect(() => {
                      const range = commenting()
                      scheduleComments()
                      if (!range) return
                      setDraft("")
                    })

                    createEffect(() => {
                      const focus = comments.focus()
                      const p = path()
                      if (!focus || !p) return
                      if (focus.file !== p) return
                      if (activeTab() !== tab) return

                      const target = fileComments().find((comment) => comment.id === focus.id)
                      if (!target) return

                      setOpenedComment(target.id)
                      setCommenting(null)
                      file.setSelectedLines(p, target.selection)
                      requestAnimationFrame(() => comments.clearFocus())
                    })

                    const renderCode = (source: string, wrapperClass: string) => (
                      <div
                        ref={(el) => {
                          wrap = el
                          scheduleComments()
                        }}
                        class={`relative overflow-hidden ${wrapperClass}`}
                      >
                        <Dynamic
                          component={codeComponent}
                          file={{
                            name: path() ?? "",
                            contents: source,
                            cacheKey: cacheKey(),
                          }}
                          enableLineSelection
                          selectedLines={selectedLines()}
                          commentedLines={commentedLines()}
                          onRendered={() => {
                            requestAnimationFrame(restoreScroll)
                            requestAnimationFrame(scheduleComments)
                          }}
                          onLineSelected={(range: SelectedLineRange | null) => {
                            const p = path()
                            if (!p) return
                            file.setSelectedLines(p, range)
                            if (!range) setCommenting(null)
                          }}
                          onLineSelectionEnd={(range: SelectedLineRange | null) => {
                            if (!range) {
                              setCommenting(null)
                              return
                            }

                            setOpenedComment(null)
                            setCommenting(range)
                          }}
                          overflow="scroll"
                          class="select-text"
                        />
                        <For each={fileComments()}>
                          {(comment) => (
                            <LineCommentView
                              id={comment.id}
                              top={positions()[comment.id]}
                              open={openedComment() === comment.id}
                              comment={comment.comment}
                              selection={commentLabel(comment.selection)}
                              onMouseEnter={() => {
                                const p = path()
                                if (!p) return
                                file.setSelectedLines(p, comment.selection)
                              }}
                              onClick={() => {
                                const p = path()
                                if (!p) return
                                setCommenting(null)
                                setOpenedComment((current) => (current === comment.id ? null : comment.id))
                                file.setSelectedLines(p, comment.selection)
                              }}
                            />
                          )}
                        </For>
                        <Show when={commenting()}>
                          {(range) => (
                            <Show when={draftTop() !== undefined}>
                              <LineCommentEditor
                                top={draftTop()}
                                value={draft()}
                                selection={commentLabel(range())}
                                onInput={(value) => setDraft(value)}
                                onCancel={() => setCommenting(null)}
                                onSubmit={(value) => {
                                  const p = path()
                                  if (!p) return
                                  addCommentToContext({
                                    file: p,
                                    selection: range(),
                                    comment: value,
                                  })
                                  setCommenting(null)
                                }}
                                onPopoverFocusOut={(e: FocusEvent) => {
                                  const current = e.currentTarget as HTMLDivElement
                                  const target = e.relatedTarget
                                  if (target instanceof Node && current.contains(target)) return

                                  setTimeout(() => {
                                    if (!document.activeElement || !current.contains(document.activeElement)) {
                                      setCommenting(null)
                                    }
                                  }, 0)
                                }}
                              />
                            </Show>
                          )}
                        </Show>
                      </div>
                    )

                    const getCodeScroll = () => {
                      const el = scroll
                      if (!el) return []

                      const host = el.querySelector("diffs-container")
                      if (!(host instanceof HTMLElement)) return []

                      const root = host.shadowRoot
                      if (!root) return []

                      return Array.from(root.querySelectorAll("[data-code]")).filter(
                        (node): node is HTMLElement => node instanceof HTMLElement && node.clientWidth > 0,
                      )
                    }

                    const queueScrollUpdate = (next: { x: number; y: number }) => {
                      pending = next
                      if (scrollFrame !== undefined) return

                      scrollFrame = requestAnimationFrame(() => {
                        scrollFrame = undefined

                        const next = pending
                        pending = undefined
                        if (!next) return

                        view().setScroll(tab, next)
                      })
                    }

                    const handleCodeScroll = (event: Event) => {
                      const el = scroll
                      if (!el) return

                      const target = event.currentTarget
                      if (!(target instanceof HTMLElement)) return

                      queueScrollUpdate({
                        x: target.scrollLeft,
                        y: el.scrollTop,
                      })
                    }

                    const syncCodeScroll = () => {
                      const next = getCodeScroll()
                      if (next.length === codeScroll.length && next.every((el, i) => el === codeScroll[i])) return

                      for (const item of codeScroll) {
                        item.removeEventListener("scroll", handleCodeScroll)
                      }

                      codeScroll = next

                      for (const item of codeScroll) {
                        item.addEventListener("scroll", handleCodeScroll)
                      }
                    }

                    const restoreScroll = () => {
                      const el = scroll
                      if (!el) return

                      const s = view()?.scroll(tab)
                      if (!s) return

                      syncCodeScroll()

                      if (codeScroll.length > 0) {
                        for (const item of codeScroll) {
                          if (item.scrollLeft !== s.x) item.scrollLeft = s.x
                        }
                      }

                      if (el.scrollTop !== s.y) el.scrollTop = s.y

                      if (codeScroll.length > 0) return

                      if (el.scrollLeft !== s.x) el.scrollLeft = s.x
                    }

                    const handleScroll = (event: Event & { currentTarget: HTMLDivElement }) => {
                      if (codeScroll.length === 0) syncCodeScroll()

                      queueScrollUpdate({
                        x: codeScroll[0]?.scrollLeft ?? event.currentTarget.scrollLeft,
                        y: event.currentTarget.scrollTop,
                      })
                    }

                    createEffect(
                      on(
                        () => state()?.loaded,
                        (loaded) => {
                          if (!loaded) return
                          requestAnimationFrame(restoreScroll)
                        },
                        { defer: true },
                      ),
                    )

                    createEffect(
                      on(
                        () => file.ready(),
                        (ready) => {
                          if (!ready) return
                          requestAnimationFrame(restoreScroll)
                        },
                        { defer: true },
                      ),
                    )

                    createEffect(
                      on(
                        () => tabs().active() === tab,
                        (active) => {
                          if (!active) return
                          if (!state()?.loaded) return
                          requestAnimationFrame(restoreScroll)
                        },
                      ),
                    )

                    onCleanup(() => {
                      for (const item of codeScroll) {
                        item.removeEventListener("scroll", handleCodeScroll)
                      }

                      if (scrollFrame === undefined) return
                      cancelAnimationFrame(scrollFrame)
                    })

                    return (
                      <Tabs.Content
                        value={tab}
                        class="mt-1 relative"
                        ref={(el: HTMLDivElement) => {
                          scroll = el
                          restoreScroll()
                        }}
                        onScroll={handleScroll}
                      >
                        <Switch>
                          <Match when={state()?.loaded && isImage()}>
                            <div class="px-6 py-4 pb-40">
                              <img
                                src={imageDataUrl()}
                                alt={path()}
                                class="max-w-full"
                                onLoad={() => requestAnimationFrame(restoreScroll)}
                              />
                            </div>
                          </Match>
                          <Match when={state()?.loaded && isSvg()}>
                            <div class="flex flex-col gap-4 px-6 py-4">
                              {renderCode(svgContent() ?? "", "")}
                              <Show when={svgPreviewUrl()}>
                                <div class="flex justify-center pb-40">
                                  <img src={svgPreviewUrl()} alt={path()} class="max-w-full max-h-96" />
                                </div>
                              </Show>
                            </div>
                          </Match>
                          <Match when={state()?.loaded && isBinary()}>
                            <div class="h-full px-6 pb-42 flex flex-col items-center justify-center text-center gap-6">
                              <Mark class="w-14 opacity-10" />
                              <div class="flex flex-col gap-2 max-w-md">
                                <div class="text-14-semibold text-text-strong truncate">{path()?.split("/").pop()}</div>
                                <div class="text-14-regular text-text-weak">
                                  {language.t("session.files.binaryContent")}
                                </div>
                              </div>
                            </div>
                          </Match>
                          <Match when={state()?.loaded && isHtml() && previewHtml()}>
                            <div class="flex flex-col h-full">
                              <div class="flex items-center justify-end px-4 py-1 border-b border-border-weak-base bg-background-base gap-2">
                                <button
                                  class="px-3 py-1 text-12-medium text-text-weak hover:text-text-strong rounded-sm transition-colors border border-border-base bg-surface-raised-base hover:bg-surface-base-active"
                                  onClick={() => {
                                    const p = path()
                                    if (!p) return
                                    const url = `${window.location.origin}/preview/${base64Encode(sdk.directory)}?path=${encodeURIComponent(p)}`
                                    window.open(url, "_blank")
                                  }}
                                >
                                  浏览器打开
                                </button>
                                <div class="flex bg-surface-raised-base rounded-md p-0.5 border border-border-base">
                                  <button
                                    class="px-3 py-1 text-12-medium rounded-sm transition-colors"
                                    classList={{
                                      "bg-surface-base-active text-text-strong shadow-sm": !previewHtml(),
                                      "text-text-weak hover:text-text-strong": previewHtml(),
                                    }}
                                    onClick={() => setPreviewHtml(false)}
                                  >
                                    代码
                                  </button>
                                  <button
                                    class="px-3 py-1 text-12-medium rounded-sm transition-colors"
                                    classList={{
                                      "bg-surface-base-active text-text-strong shadow-sm": previewHtml(),
                                      "text-text-weak hover:text-text-strong": !previewHtml(),
                                    }}
                                    onClick={() => setPreviewHtml(true)}
                                  >
                                    预览
                                  </button>
                                </div>
                              </div>
                              <div class="flex-1 min-h-0 relative w-full h-full bg-background-base">
                                <iframe srcdoc={contents()} class="w-full h-full border-none" sandbox="allow-scripts" />
                              </div>
                            </div>
                          </Match>
                          <Match when={state()?.loaded && isMarkdown() && previewHtml()}>
                            <div class="flex flex-col h-full">
                              <div class="flex items-center justify-end px-4 py-1 border-b border-border-weak-base bg-background-base gap-2">
                                <div class="flex bg-surface-raised-base rounded-md p-0.5 border border-border-base">
                                  <button
                                    class="px-3 py-1 text-12-medium rounded-sm transition-colors"
                                    classList={{
                                      "bg-surface-base-active text-text-strong shadow-sm": !previewHtml(),
                                      "text-text-weak hover:text-text-strong": previewHtml(),
                                    }}
                                    onClick={() => setPreviewHtml(false)}
                                  >
                                    代码
                                  </button>
                                  <button
                                    class="px-3 py-1 text-12-medium rounded-sm transition-colors"
                                    classList={{
                                      "bg-surface-base-active text-text-strong shadow-sm": previewHtml(),
                                      "text-text-weak hover:text-text-strong": !previewHtml(),
                                    }}
                                    onClick={() => setPreviewHtml(true)}
                                  >
                                    预览
                                  </button>
                                </div>
                              </div>
                              <div class="flex-1 min-h-0 relative w-full h-full bg-background-base overflow-auto px-8 py-6">
                                <div
                                  class="prose dark:prose-invert max-w-none"
                                  ref={(el) => {
                                    const content = contents() ?? ""
                                    Promise.resolve(marked.parse(content)).then((html) => {
                                      el.innerHTML = html as string
                                    })
                                  }}
                                />
                              </div>
                            </div>
                          </Match>
                          <Match when={state()?.loaded}>
                            <div class="flex flex-col h-full">
                              <Show when={isHtml() || isMarkdown()}>
                                <div class="flex items-center justify-end px-4 py-1 border-b border-border-weak-base bg-background-base">
                                  <div class="flex bg-surface-raised-base rounded-md p-0.5 border border-border-base">
                                    <button
                                      class="px-3 py-1 text-12-medium rounded-sm transition-colors"
                                      classList={{
                                        "bg-surface-base-active text-text-strong shadow-sm": !previewHtml(),
                                        "text-text-weak hover:text-text-strong": previewHtml(),
                                      }}
                                      onClick={() => setPreviewHtml(false)}
                                    >
                                      代码
                                    </button>
                                    <button
                                      class="px-3 py-1 text-12-medium rounded-sm transition-colors"
                                      classList={{
                                        "bg-surface-base-active text-text-strong shadow-sm": previewHtml(),
                                        "text-text-weak hover:text-text-strong": !previewHtml(),
                                      }}
                                      onClick={() => setPreviewHtml(true)}
                                    >
                                      预览
                                    </button>
                                  </div>
                                </div>
                              </Show>
                              <div class="flex-1 min-h-0 relative">{renderCode(contents(), "pb-40")}</div>
                            </div>
                          </Match>
                          <Match when={state()?.loading}>
                            <div class="px-6 py-4 text-text-weak">{language.t("common.loading")}...</div>
                          </Match>
                          <Match when={state()?.error}>
                            {(err) => <div class="px-6 py-4 text-text-weak">{err()}</div>}
                          </Match>
                        </Switch>
                      </Tabs.Content>
                    )
                  }}
                </For>
              </Tabs>
              <DragOverlay>
                <Show when={store.activeDraggable}>
                  {(tab) => {
                    const path = createMemo(() => file.pathFromTab(tab()))
                    return (
                      <div class="relative px-6 h-12 flex items-center bg-background-stronger border-x border-border-weak-base border-b border-b-transparent">
                        <Show when={path()}>{(p) => <FileVisual active path={p()} />}</Show>
                      </div>
                    )
                  }}
                </Show>
              </DragOverlay>
            </DragDropProvider>
          </div>
        </Show>

        <Show when={layout.fileTree.opened()}>
          <div
            id="file-tree-panel"
            class="relative shrink-0 h-full"
            style={{ width: `${layout.fileTree.width()}px` }}
          >
            <div class="h-full border-l border-border-weak-base flex flex-col overflow-hidden group/filetree">
              <Tabs variant="pill" value={fileTreeTab()} onChange={setFileTreeTabValue} class="h-full" data-scope="filetree">
                <Tabs.List>
                  <Tabs.Trigger value="all" class="flex-1" classes={{ button: "w-full" }}>
                    {language.t("session.files.all")}
                  </Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content
                  value="all"
                  class="bg-background-base px-3 py-0 h-full"
                  onClick={(e: MouseEvent) => {
                    if (!(e.target as HTMLElement).closest("[data-file-node]")) {
                      setSelectedPaths(new Set<string>())
                    }
                  }}
                >
                  <ContextMenu>
                    <ContextMenu.Trigger class="h-full">
                      <FileTree
                        path=""
                        selectedPaths={selectedPaths()}
                        onSelectionChange={setSelectedPaths}
                        onFileClick={(node) => openTab(file.tab(node.path))}
                      />
                    </ContextMenu.Trigger>
                    <Show when={platform.platform === "web"}>
                      <ContextMenu.Content>
                        <ContextMenu.Item onSelect={handleRootUpload}>
                          <div class="flex items-center gap-2">
                            <Icon name="cloud-upload" size="small" />
                            <span>上传到根目录</span>
                          </div>
                        </ContextMenu.Item>
                      </ContextMenu.Content>
                    </Show>
                  </ContextMenu>
                </Tabs.Content>
              </Tabs>
            </div>
            <ResizeHandle
              direction="horizontal"
              edge="start"
              size={layout.fileTree.width()}
              min={240}
              max={380}
              collapseThreshold={160}
              onResize={layout.fileTree.resize}
              onCollapse={layout.fileTree.close}
            />
          </div>
        </Show>
      </div>
    </aside>
  )
}
