import { For, Show, createMemo } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { useNavigate, useParams } from "@solidjs/router"
import { useSync } from "@/context/sync"
import { useGlobalSync } from "@/context/global-sync"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DialogSettings } from "@/components/dialog-settings"
import { DialogSkills } from "@/components/dialog-skills"
import { useSDK } from "@/context/sdk"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"

interface SidebarProps {
  class?: string
}

/**
 * 从消息中提取会话标题
 */
function extractSessionTitle(session: any, messages: any[] | undefined, allParts: Record<string, any[]> | undefined): string {
  // 1. 优先使用 session.title (如果不是默认格式)
  if (session.title && !session.title.startsWith("会话 ") && !session.title.startsWith("Session ")) {
    return session.title
  }

  // 2. 尝试从第一条用户消息提取
  if (messages && messages.length > 0) {
    const firstUserMessage = messages.find((m: any) => m.role === "user")
    if (firstUserMessage) {
      // 从 parts 中找到 text 类型的内容
      const parts = allParts?.[firstUserMessage.id] || []
      const textPart = parts.find((p: any) => p.type === "text")
      
      if (textPart && textPart.text) {
        const content = textPart.text.trim()
        return content.length > 30 ? content.slice(0, 30) + "..." : content
      }
    }
  }

  // 3. Fallback
  return session.title || `会话 ${session.id.slice(0, 8)}`
}

/**
 * Sidebar - 左侧导航面板
 * 宽度: 280px
 * 包含: Logo、新建任务、技能管理、历史任务、设置
 */
export function Sidebar(props: SidebarProps) {
  const navigate = useNavigate()
  const params = useParams<{ dir: string; id?: string }>()
  const sync = useSync()
  const globalSync = useGlobalSync()
  const sdk = useSDK()
  const dialog = useDialog()
  const language = useLanguage()

  // 当前会话ID
  const currentSessionID = () => params.id ?? "new"

  // 会话列表 - 从sync获取真实数据
  const sessions = createMemo(() => sync.data.session || [])

  // 历史任务列表（排除new和已归档）
  const historySessions = createMemo(() => {
    return sessions()
      .filter((s) => s.id !== "new" && !s.time?.archived)
      .toSorted((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
      .map((session) => {
        const messages = sync.data.message[session.id] || []
        return {
          id: session.id,
          title: extractSessionTitle(session, messages, sync.data.part),
          directory: session.directory,
        }
      })
  })

  // 归档/删除会话
  async function archiveSession(sessionID: string, directory: string, event: MouseEvent) {
    event.stopPropagation()

    const [store] = globalSync.child(directory)
    const sessions = store.session ?? []
    const index = sessions.findIndex((s) => s.id === sessionID)
    const nextSession = sessions[index + 1] ?? sessions[index - 1]

    console.log("[Sidebar] archiveSession start:", sessionID)
    try {
      console.log("[Sidebar] calling sdk.client.session.update...")
      await sdk.client.session.update({
        directory: sdk.directory,
        sessionID: sessionID,
        time: { archived: Date.now() },
      })
      console.log("[Sidebar] sdk.client.session.update success")

      // 立即从本地store中移除会话，确保UI立即响应
      // 递归查找并移除所有子会话
      sync.set("session", (prev) => {
        console.log("[Sidebar] updating local session list, prev length:", prev?.length)
        const removed = new Set<string>([sessionID])
        
        // 构建 parent 映射
        const byParent = new Map<string, string[]>()
        for (const item of prev) {
          const parentID = item.parentID
          if (!parentID) continue
          const existing = byParent.get(parentID)
          if (existing) {
            existing.push(item.id)
            continue
          }
          byParent.set(parentID, [item.id])
        }

        // 递归查找子会话
        const stack = [sessionID]
        while (stack.length) {
          const parentID = stack.pop()
          if (!parentID) continue

          const children = byParent.get(parentID)
          if (!children) continue

          for (const child of children) {
            if (removed.has(child)) continue
            removed.add(child)
            stack.push(child)
          }
        }

        return prev.filter((s) => !removed.has(s.id))
      })

      // 如果删除的是当前会话，导航到下一个会话或主页
      if (sessionID === currentSessionID()) {
        // 使用 setTimeout 延迟导航，确保状态更新完成
        setTimeout(() => {
          // 重新计算 nextSession，因为 sessions 列表已经变了（虽然这里用的是闭包前的 sessions，但逻辑上我们希望找下一个未归档的）
          // 但由于我们已经有了 index，尝试找下一个。
          // 更好的方式是看 historySessions() 的长度，如果为空则去主页
          
          // 如果还有历史任务，尝试跳转到下一个
          if (nextSession && nextSession.id !== "new" && !nextSession.time?.archived) {
            navigate(`/${params.dir}/session/${nextSession.id}`)
          } else {
            // 否则回到主页
            navigate(`/${params.dir}`)
          }
        }, 0)
      }

      showToast({
        variant: "success",
        title: language.t("common.success"),
        description: language.t("session.archive.success"),
      })
    } catch (error) {
      console.error("删除会话失败:", error)
      showToast({
        variant: "error",
        title: language.t("common.error"),
        description: language.t("session.archive.failed"),
      })
    }
  }

  function handleNewTask() {
    navigate(`/${params.dir}/session/new`)
  }

  function handleSkills() {
    dialog.show(() => <DialogSkills />)
  }

  function handleSessionClick(sessionID: string) {
    navigate(`/${params.dir}/session/${sessionID}`)
  }

  function handleSettings() {
    dialog.show(() => <DialogSettings />)
  }

  return (
    <aside class={`flex h-full w-[280px] flex-col bg-background-base ${props.class ?? ""}`}>
      {/* Logo区域 */}
      <div class="flex flex-col gap-1 px-5 py-5 pb-4 border-b border-border-weak-base">
        <span class="font-['JetBrains_Mono'] text-2xl font-bold text-gradient-brand">发小</span>
        <span class="font-['Inter'] text-xs text-text-weak opacity-80">发小更懂你</span>
      </div>

      {/* 导航区域 */}
      <nav class="flex flex-1 flex-col gap-2 px-3 py-4 pt-4 pb-2 overflow-y-auto">
        {/* 新建任务按钮 */}
        <button
          class="flex items-center gap-3 h-11 px-3 rounded-xl bg-surface-raised-base hover:bg-surface-base-hover hover:shadow-soft transition-all duration-200 group"
          onClick={handleNewTask}
        >
          <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-background-base group-hover:scale-110 transition-transform">
            <Icon name="plus" size="normal" class="text-primary-base" />
          </div>
          <span class="font-['JetBrains_Mono'] text-sm font-semibold text-text-strong">新建任务</span>
        </button>

        {/* 技能管理按钮 */}
        <button
          class="flex items-center gap-3 h-11 px-3 rounded-xl bg-surface-raised-base hover:bg-surface-base-hover hover:shadow-soft transition-all duration-200 group"
          onClick={handleSkills}
        >
          <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-background-base group-hover:scale-110 transition-transform">
            <Icon name="sparkles" size="normal" class="text-primary-base" />
          </div>
          <span class="font-['Inter'] text-sm font-medium text-text-strong">技能管理</span>
        </button>

        {/* 历史任务 */}
        <Show when={historySessions().length > 0}>
          <div class="mt-6">
            <span class="px-2 font-['Inter'] text-[10px] uppercase font-bold text-text-weaker tracking-widest opacity-60">历史任务</span>
            <div class="mt-3 flex flex-col gap-1">
              <For each={historySessions()}>
                {(session) => {
                  const isActive = () => session.id === currentSessionID()
                  return (
                    <button
                      classList={{
                        "flex items-center gap-2 h-9 px-3 rounded-lg w-full text-left transition-all duration-200 group relative": true,
                        "bg-surface-base-active shadow-sm": isActive(),
                        "hover:bg-surface-base-hover hover:pl-4": !isActive(),
                      }}
                      onClick={() => handleSessionClick(session.id)}
                    >
                      <Show when={isActive()}>
                        <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-gradient-brand" />
                      </Show>
                      
                      <Icon name="clock" size="small" class={isActive() ? "text-primary-base" : "text-text-weaker group-hover:text-text-weak"} />
                      <span
                        classList={{
                          "font-['Inter'] text-sm truncate flex-1 text-left transition-colors": true,
                          "font-medium text-text-strong": isActive(),
                          "font-normal text-text-weak group-hover:text-text-strong": !isActive(),
                        }}
                      >
                        {session.title}
                      </span>
                      {/* 删除按钮 - 悬停时显示 */}
                      <IconButton
                        icon="trash"
                        variant="ghost"
                        class="size-6 opacity-0 group-hover:opacity-100 hover:text-error-base transition-opacity scale-90"
                        onClick={(e) => archiveSession(session.id, session.directory, e)}
                      />
                    </button>
                  )
                }}
              </For>
            </div>
          </div>
        </Show>
      </nav>

      {/* 设置区域 */}
      <div class="flex flex-col gap-2 px-3 py-3 pt-3 pb-4 border-t border-border-weak-base">
        <button
          class="flex items-center gap-2.5 h-10 px-3 rounded-lg hover:bg-surface-base-hover transition-colors"
          onClick={handleSettings}
        >
          <Icon name="settings-gear" size="small" class="text-text-weak" />
          <span class="font-['Inter'] text-sm font-medium text-text-weak">设置</span>
        </button>
      </div>
    </aside>
  )
}
