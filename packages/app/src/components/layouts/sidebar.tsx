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

import { DialogConfirm } from "@/components/dialog-confirm"

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
    // 如果没有选择工作空间，不显示历史任务
    if (!params.dir) return []

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

    dialog.show(() => (
      <DialogConfirm
        title="确认删除"
        description="确定要删除此会话吗？此操作不可恢复。"
        confirmText="删除"
        cancelText="取消"
        onConfirm={async () => {
          const [store] = globalSync.child(directory)
          const sessions = store.session ?? []
          const index = sessions.findIndex((s) => s.id === sessionID)
          const nextSession = sessions[index + 1] ?? sessions[index - 1]

          try {
            await sdk.client.session.update({
              directory: sdk.directory,
              sessionID: sessionID,
              time: { archived: Date.now() },
            })

            // 立即从本地store中移除会话，确保UI立即响应
            // 递归查找并移除所有子会话
            sync.set("session", (prev) => {
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
        }}
      />
    ))
  }

  function handleNewTask() {
    if (!params.dir) {
      return
    }
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
      <div class="flex flex-col gap-1 px-5 py-5 pb-4">
        <div class="flex items-center gap-2">
          <div class="flex items-center justify-center w-8 h-8">
            <svg class="w-full h-full drop-shadow-sm" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="robot-body" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#F8FAFC" />
                  <stop offset="100%" stop-color="#E2E8F0" />
                </linearGradient>
                <linearGradient id="screen-glow" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#60A5FA" stop-opacity="0.2" />
                  <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.1" />
                </linearGradient>
              </defs>

              {/* 机器人头部 */}
              <rect x="35" y="20" width="30" height="25" rx="6" fill="url(#robot-body)" stroke="#94A3B8" stroke-width="2" />
              {/* 眼睛 */}
              <circle cx="43" cy="32" r="3" fill="#3B82F6">
                <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="57" cy="32" r="3" fill="#3B82F6">
                <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
              </circle>
              {/* 天线 */}
              <line x1="50" y1="20" x2="50" y2="12" stroke="#94A3B8" stroke-width="2" />
              <circle cx="50" cy="10" r="3" fill="#F472B6">
                <animate attributeName="fill" values="#F472B6;#FB7185;#F472B6" dur="1s" repeatCount="indefinite" />
              </circle>

              {/* 机器人身体 */}
              <path d="M25 50C25 47.2386 27.2386 45 30 45H70C72.7614 45 75 47.2386 75 50V80C75 82.7614 72.7614 85 70 85H30C27.2386 85 25 82.7614 25 80V50Z" fill="url(#robot-body)" stroke="#94A3B8" stroke-width="2" />
              
              {/* 屏幕/工作区 */}
              <rect x="32" y="52" width="36" height="20" rx="2" fill="#1E293B" />
              <rect x="34" y="54" width="32" height="16" fill="url(#screen-glow)" />
              {/* 代码行动画 */}
              <rect x="36" y="58" width="20" height="2" rx="1" fill="#38BDF8">
                <animate attributeName="width" values="0;20;20" dur="2s" repeatCount="indefinite" />
              </rect>
              <rect x="36" y="62" width="15" height="2" rx="1" fill="#A78BFA">
                <animate attributeName="width" values="0;15;15" dur="2s" begin="0.5s" repeatCount="indefinite" />
              </rect>
              <rect x="36" y="66" width="24" height="2" rx="1" fill="#34D399">
                <animate attributeName="width" values="0;24;24" dur="2s" begin="1s" repeatCount="indefinite" />
              </rect>

              {/* 机械手臂 */}
              <path d="M25 55L15 65L20 70" stroke="#94A3B8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <animateTransform attributeName="transform" type="rotate" values="0 25 55; 5 25 55; 0 25 55" dur="1s" repeatCount="indefinite" />
              </path>
              <path d="M75 55L85 65L80 70" stroke="#94A3B8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <animateTransform attributeName="transform" type="rotate" values="0 75 55; -5 75 55; 0 75 55" dur="1s" repeatCount="indefinite" />
              </path>
            </svg>
          </div>
          <span class="font-['JetBrains_Mono'] text-[24px] font-extrabold text-gradient-brand tracking-tight leading-[1.2] select-none">发小</span>
        </div>
        <span class="font-['Inter'] text-xs text-text-weak opacity-80 pl-1">您的全能办公助手</span>
      </div>

      {/* 导航区域 */}
      <nav class="flex flex-1 flex-col gap-2 px-3 py-4 pt-4 pb-2 overflow-y-auto">
        {/* 新建任务按钮 */}
        <button
          class="flex items-center gap-3 h-11 px-3 rounded-xl hover:bg-surface-base-hover hover:shadow-soft transition-all duration-200 group"
          onClick={handleNewTask}
        >
          <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-background-base group-hover:scale-110 transition-transform">
            <Icon name="plus" size="normal" class="text-primary-base" />
          </div>
          <span class="font-['JetBrains_Mono'] text-sm font-semibold text-text-strong">新建任务</span>
        </button>

        {/* 技能管理按钮 */}
        <button
          class="flex items-center gap-3 h-11 px-3 rounded-xl hover:bg-surface-base-hover hover:shadow-soft transition-all duration-200 group"
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
            <span class="px-2 font-['Inter'] text-[14px] uppercase font-bold text-text-weaker tracking-widest opacity-60">历史任务</span>
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
      <div class="flex flex-col gap-2 px-3 py-3 pt-3 pb-4">
        <button
          class="flex items-center gap-3 h-10 px-3 rounded-lg hover:bg-surface-base-hover transition-colors"
          onClick={handleSettings}
        >
          <Icon name="settings-gear" size="small" class="text-text-weak" />
          <span class="font-['Inter'] text-sm font-medium text-text-weak">设置</span>
        </button>
      </div>
    </aside>
  )
}
