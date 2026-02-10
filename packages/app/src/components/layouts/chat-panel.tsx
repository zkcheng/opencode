import { For, Show, createMemo, createEffect, createSignal } from "solid-js"
import { useParams, useNavigate } from "@solidjs/router"
import { Icon, type IconProps } from "@opencode-ai/ui/icon"
import { SessionTurn } from "@opencode-ai/ui/session-turn"
import { PromptInput } from "@/components/prompt-input"
import { DialogSelectWorkspace } from "@/components/dialog-select-workspace"
import { useSync } from "@/context/sync"
import { useLayout } from "@/context/layout"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useSDK } from "@/context/sdk"
import { createAutoScroll } from "@opencode-ai/ui/hooks"
import { getFilename } from "@opencode-ai/util/path"
import { base64Encode, base64Decode } from "@opencode-ai/util/encode"

// 创建一个响应式的目录值，确保更新时能正确触发
function useCurrentDirectory(sdk: ReturnType<typeof useSDK>) {
  return createMemo(() => sdk.directory)
}

interface ChatPanelProps {
  viewMode: "default" | "chat-preview" | "chat-only"
  sessionID: string
  class?: string
}

/**
 * 从消息中提取会话标题
 */
function extractSessionTitle(messages: any[] | undefined, sessionID: string): string {
  if (!messages || messages.length === 0) {
    return "新任务"
  }
  // 找到第一条用户消息
  const firstUserMessage = messages.find((m) => m.role === "user")
  if (!firstUserMessage) {
    return "新任务"
  }
  // 从parts中找到text类型的内容
  const parts = firstUserMessage.parts || []
  const textPart = parts.find((p: any) => p.type === "text")
  if (textPart && textPart.content) {
    const content = textPart.content.trim()
    // 限制标题长度
    return content.length > 30 ? content.slice(0, 30) + "..." : content
  }
  return "新任务"
}

/**
 * ChatPanel - 对话界面组件
 * - default: 默认状态（欢迎页）
 * - chat-preview: 对话状态-预览模式 (560px宽)
 * - chat-only: 对话状态-无预览 (920px宽)
 */
export function ChatPanel(props: ChatPanelProps) {
  const sync = useSync()
  const layout = useLayout()
  const params = useParams()
  const dialog = useDialog()
  const sdk = useSDK()
  const navigate = useNavigate()
  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({})
  const [start, setStart] = createSignal(0)
  const autoScroll = createAutoScroll({
    working: () => true,
    overflowAnchor: "dynamic",
  })

  // 当前工作目录 - 使用 createMemo 确保响应式更新
  const currentDirectory = createMemo(() => {
    // 1. 优先使用 sdk 中的目录
    if (sdk.directory) {
      return sdk.directory
    }

    // 2. 尝试从路由参数获取 (作为 sdk 的备份)
    if (params.dir) {
      try {
        return base64Decode(params.dir)
      } catch (e) {
        console.error("解码 dir 失败:", e)
      }
    }

    // 3. 最后使用用户手动选择的目录
    if (selectedWorkspaceDir()) {
      return selectedWorkspaceDir()
    }

    return undefined
  })

  // 工作空间选择状态 - 保存选中的工作空间目录
  const [selectedWorkspaceDir, setSelectedWorkspaceDir] = createSignal<string | undefined>(undefined)

  // 是否是新建会话
  const isNewSession = createMemo(() => props.sessionID === "new" || props.sessionID === "")

  // 当会话 ID 变化时，重置工作空间选择状态
  createEffect(() => {
    const id = props.sessionID
    // 只在真正切换到新会话时重置
    if (id === "new" || id === "") {
      // 重置工作空间选择，但不改变当前目录
      // 这样可以确保新建会话时使用正确的目录
    }
  })

  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const tabs = createMemo(() => layout.tabs(sessionKey()))
  const hasPreview = createMemo(() => tabs().all().length > 0)

  // 确保会话数据已加载
  createEffect(() => {
    const id = props.sessionID
    if (id !== "new" && id !== "" && sync.ready) {
      sync.session.sync(id)
    }
  })

  // 当前会话的消息列表
  const messages = createMemo(() => {
    if (isNewSession()) return []
    return sync.data.message[props.sessionID] || []
  })

  const messagesReady = createMemo(() => {
    const id = props.sessionID
    if (id === "new" || id === "") return true
    return sync.data.message[id] !== undefined
  })

  const historyMore = createMemo(() => {
    const id = props.sessionID
    if (id === "new" || id === "") return false
    return sync.session.history.more(id)
  })

  const historyLoading = createMemo(() => {
    const id = props.sessionID
    if (id === "new" || id === "") return false
    return sync.session.history.loading(id)
  })

  const info = createMemo(() => {
    const id = props.sessionID
    if (id === "new" || id === "") return
    return sync.session.get(id)
  })

  const revert = createMemo(() => info()?.revert?.messageID)

  // 当前会话的用户消息列表（和原来一样，迭代用户消息）
  const userMessages = createMemo(() => {
    return messages().filter((m) => m.role === "user")
  })

  const visibleUserMessages = createMemo(() => {
    const id = revert()
    if (!id) return userMessages()
    return userMessages().filter((m) => m.id < id)
  })

  const renderedUserMessages = createMemo(() => {
    const msgs = visibleUserMessages()
    const value = start()
    if (value <= 0) return msgs
    if (value >= msgs.length) return []
    return msgs.slice(value)
  })

  // 会话标题
  const sessionTitle = createMemo(() => {
    // 优先从 session info 中获取标题
    const info = sync.session.get(props.sessionID)
    if (info?.title && !info.title.startsWith("会话 ") && !info.title.startsWith("Session ")) {
      return info.title
    }
    return extractSessionTitle(messages(), props.sessionID)
  })

  // 最后一条用户消息（用于SessionTurn）
  const lastUserMessage = createMemo(() => visibleUserMessages().at(-1))

  // 打开工作空间选择对话框
  function handleOpenWorkspaceSelector() {
    dialog.show(() => (
      <DialogSelectWorkspace
        currentDirectory={currentDirectory()}
        onSelect={(workspaceDir) => {
          console.log("选择工作空间:", workspaceDir, "当前目录:", currentDirectory())
          setSelectedWorkspaceDir(workspaceDir)
          // 导航到新目录的 URL
          const encodedDir = base64Encode(workspaceDir)
          console.log("导航到:", `/${encodedDir}/session`)
          navigate(`/${encodedDir}/session`)
        }}
      />
    ))
  }

  // 获取当前工作空间显示名称
  const currentWorkspaceLabel = createMemo(() => {
    // 使用 currentDirectory() 作为当前目录，因为它是响应式的
    const dir = currentDirectory()
    if (!dir) return "关联工作空间"
    return getFilename(dir)
  })

  const panelWidth = () => {
    return "flex-1"
  }

  const containerStyle = createMemo(() => {
    if (isNewSession()) return {}

    if (hasPreview()) {
      return {
        "min-width": "400px",
        // "max-width": "800px",
      }
    }

    return {
      "min-width": "600px",
      "max-width": "920px",
    }
  })

  return (
    <main class={`flex flex-col h-full bg-background-base ${panelWidth()} ${props.class ?? ""}`}>
      <div
        class="flex-1 w-full flex flex-col items-center h-full min-h-0"
        style={hasPreview() ? {} : { "background-color": "var(--background-page)" }}
      >
        <div class="w-full h-full bg-background-base flex flex-col mx-auto" style={containerStyle()}>
          <Show when={props.viewMode === "default" || isNewSession()}>
            {/* 默认状态 - 欢迎页 */}
            <div class="relative flex flex-col items-center justify-center h-full gap-10 overflow-hidden">
              {/* 背景装饰光晕 */}
              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-brand opacity-5 blur-[120px] rounded-full pointer-events-none" />

              {/* Slogan */}
              <div class="relative flex flex-col items-center justify-center gap-2 z-10">
                <h1 class="font-['JetBrains_Mono'] text-4xl md:text-5xl font-bold text-gradient-brand tracking-tight">发小更懂你</h1>
                <p class="font-['Inter'] text-text-weak opacity-80">您的智能编程助手，随时待命</p>
              </div>

              {/* 输入框 - 使用PromptInput */}
              <div class="relative flex flex-col items-center justify-center w-full px-6 gap-4 z-10">
                <div class="w-full max-w-3xl flex flex-col gap-3">
                  <div class="overflow-hidden p-2">
                    <PromptInput
                      requireWorkspace={true}
                    />
                  </div>
                </div>
              </div>

              {/* 技能卡片 */}
              <div class="relative flex flex-wrap items-center justify-center gap-4 px-6 z-10">
                <SkillCard icon="code" title="代码生成" description="描述需求，自动生成代码" />
                <SkillCard icon="sparkles" title="代码解释" description="深入解析复杂逻辑" />
                <SkillCard icon="bug" title="Bug修复" description="快速定位并修复错误" />
              </div>
            </div>
          </Show>

          <Show when={props.viewMode !== "default" && !isNewSession()}>
            {/* 对话模式 - 显示标题和消息区域 */}
            {/* 标题栏 */}
            <div class="flex items-center h-15 px-[32px]">
              <h2 class="font-['Inter'] font-semibold text-lg text-text-strong">{sessionTitle()}</h2>
            </div>

            {/* 消息区域 */}
            <div
              class="flex-1 overflow-y-auto py-6"
              ref={autoScroll.scrollRef}
              onScroll={autoScroll.handleScroll}
            >
              <Show
                when={messagesReady()}
                fallback={
                  <div class="flex items-center justify-center h-full text-text-weaker">
                    <p class="font-['Inter'] text-sm">加载中...</p>
                  </div>
                }
              >
                <div ref={autoScroll.contentRef} onClick={autoScroll.handleInteraction}>
                  <Show when={start() > 0}>
                    <div class="w-full flex justify-center px-6 pb-4">
                      <button
                        type="button"
                        class="text-12-medium opacity-50"
                        onClick={() => setStart(0)}
                      >
                        显示更早消息
                      </button>
                    </div>
                  </Show>
                  <Show when={historyMore()}>
                    <div class="w-full flex justify-center px-6 pb-4">
                      <button
                        type="button"
                        class="text-12-medium opacity-50"
                        disabled={historyLoading()}
                        onClick={() => {
                          const id = props.sessionID
                          if (id === "new" || id === "") return
                          setStart(0)
                          sync.session.history.loadMore(id)
                        }}
                      >
                        {historyLoading() ? "加载更早消息中..." : "加载更早消息"}
                      </button>
                    </div>
                  </Show>
                  <For each={renderedUserMessages()}>
                    {(message) => (
                      <div class="min-w-0 w-full max-w-full px-6">
                        <SessionTurn
                          sessionID={props.sessionID}
                          messageID={message.id}
                          lastUserMessageID={lastUserMessage()?.id}
                          stepsExpanded={expanded()[message.id] ?? false}
                          onStepsExpandedToggle={() => {
                            setExpanded((prev) => ({
                              ...prev,
                              [message.id]: !(prev[message.id] ?? false),
                            }))
                          }}
                          classes={{
                            root: "min-w-0 w-full relative",
                            content: "flex flex-col justify-between !overflow-visible",
                            container: "w-full px-4 md:px-6",
                          }}
                        />
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            {/* 输入区域 - 使用PromptInput */}
            <div class="shrink-0 p-4">
              <div class="w-full max-w-4xl mx-auto">
                <PromptInput />
              </div>
            </div>
          </Show>
        </div>
      </div>
    </main>
  )
}

function SkillCard(props: { icon: IconProps["name"]; title: string; description: string }) {
  return (
    <div class="glass-panel flex flex-col items-center gap-3 px-5 py-5 rounded-2xl w-[260px] h-[140px] hover:-translate-y-1 hover:shadow-glow transition-all duration-300 cursor-default group">
      <div class="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-brand shadow-md group-hover:scale-110 transition-transform duration-300">
        <Icon name={props.icon} size="normal" class="text-white" />
      </div>
      <div class="flex flex-col gap-1.5 text-center">
        <span class="font-['Inter'] text-base font-bold text-text-strong group-hover:text-primary-base transition-colors">{props.title}</span>
        <span class="font-['Inter'] text-xs text-text-weak leading-relaxed">{props.description}</span>
      </div>
    </div>
  )
}
