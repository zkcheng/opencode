import { For, Show, createMemo } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { useNavigate, useParams } from "@solidjs/router"
import { useSync } from "@/context/sync"
import { useGlobalSync } from "@/context/global-sync"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DialogSettings } from "@/components/dialog-settings"
import { useSDK } from "@/context/sdk"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"

interface SidebarProps {
  class?: string
}

/**
 * 从消息中提取会话标题
 */
function extractSessionTitle(messages: any[] | undefined, sessionID: string): string {
  if (!messages || messages.length === 0) {
    return `会话 ${sessionID.slice(0, 8)}`
  }
  // 找到第一条用户消息
  const firstUserMessage = messages.find((m) => m.role === "user")
  if (!firstUserMessage) {
    return `会话 ${sessionID.slice(0, 8)}`
  }
  // 从parts中找到text类型的内容
  const parts = firstUserMessage.parts || []
  const textPart = parts.find((p: any) => p.type === "text")
  if (textPart && textPart.content) {
    const content = textPart.content.trim()
    // 限制标题长度
    return content.length > 30 ? content.slice(0, 30) + "..." : content
  }
  return `会话 ${sessionID.slice(0, 8)}`
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
          title: extractSessionTitle(messages, session.id),
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
    navigate(`/${params.dir}/skills`)
  }

  function handleSessionClick(sessionID: string) {
    navigate(`/${params.dir}/session/${sessionID}`)
  }

  function handleSettings() {
    dialog.show(() => <DialogSettings />)
  }

  return (
    <aside class={`flex h-full w-[280px] flex-col bg-white ${props.class ?? ""}`}>
      {/* Logo区域 */}
      <div class="flex flex-col gap-1 px-5 py-5 pb-4 border-b border-[#F3F4F6]">
        <span class="font-['JetBrains_Mono'] text-2xl font-bold text-[#A78BFA]">发小</span>
        <span class="font-['Inter'] text-xs text-[#64748B]">发小更懂你</span>
      </div>

      {/* 导航区域 */}
      <nav class="flex flex-1 flex-col gap-2 px-3 py-4 pt-4 pb-2 overflow-y-auto">
        {/* 新建任务按钮 */}
        <button
          class="flex items-center gap-3 h-11 px-3 rounded-lg bg-[#EDE9FE] hover:bg-[#DDD6FE] transition-colors"
          onClick={handleNewTask}
        >
          <Icon name="plus" size="normal" class="text-[#7C3AED]" />
          <span class="font-['JetBrains_Mono'] text-sm font-semibold text-[#0A0F1C]">新建任务</span>
        </button>

        {/* 技能管理按钮 */}
        <button
          class="flex items-center gap-3 h-11 px-3 rounded-lg bg-[#EDE9FE] hover:bg-[#DDD6FE] transition-colors"
          onClick={handleSkills}
        >
          <Icon name="sparkles" size="normal" class="text-[#A855F7]" />
          <span class="font-['Inter'] text-sm font-medium text-[#1E293B]">技能管理</span>
        </button>

        {/* 历史任务 */}
        <Show when={historySessions().length > 0}>
          <div class="mt-4">
            <span class="font-['Inter'] text-xs font-semibold text-[#475569] tracking-wider">历史任务</span>
            <div class="mt-3 flex flex-col gap-1">
              <For each={historySessions()}>
                {(session) => {
                  const isActive = () => session.id === currentSessionID()
                  return (
                    <button
                      classList={{
                        "flex items-center gap-2 h-9 px-3 rounded-lg w-full text-left transition-colors group relative": true,
                        "bg-[#F8F7FF]": isActive(),
                        "hover:bg-[#F8F7FF]": !isActive(),
                      }}
                      onClick={() => handleSessionClick(session.id)}
                    >
                      <Show when={isActive()}>
                        <div class="w-0.5 h-5 rounded-full bg-[#A855F7]" />
                      </Show>
                      <Show when={!isActive()}>
                        <div class="w-0.5 h-5 rounded-full bg-transparent" />
                      </Show>
                      <Icon name="clock" size="small" class={isActive() ? "text-[#A855F7]" : "text-[#64748B]"} />
                      <span
                        classList={{
                          "font-['Inter'] text-sm truncate flex-1 text-left": true,
                          "font-semibold text-[#A855F7]": isActive(),
                          "font-normal text-[#64748B]": !isActive(),
                        }}
                      >
                        {session.title}
                      </span>
                      {/* 删除按钮 - 悬停时显示 */}
                      <IconButton
                        icon="trash"
                        variant="ghost"
                        class="size-6 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
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
      <div class="flex flex-col gap-2 px-3 py-3 pt-3 pb-4 border-t border-[#F3F4F6]">
        <button
          class="flex items-center gap-2.5 h-10 px-3 rounded-lg hover:bg-[#F8FAFC] transition-colors"
          onClick={handleSettings}
        >
          <Icon name="settings-gear" size="small" class="text-[#64748B]" />
          <span class="font-['Inter'] text-sm font-medium text-[#475569]">设置</span>
        </button>
      </div>
    </aside>
  )
}
