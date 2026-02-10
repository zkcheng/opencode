import { For, Show, createMemo } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { useNavigate, useParams } from "@solidjs/router"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useSync } from "@/context/sync"
import { useGlobalSync } from "@/context/global-sync"
import { useGlobalSDK } from "@/context/global-sdk"
import { DialogSettings } from "@/components/dialog-settings"

interface SkillCard {
  id: string
  name: string
  description: string
  enabled: boolean
  location?: string
  content?: string
}

/**
 * 从消息中提取会话标题
 */
function extractSessionTitle(messages: any[] | undefined, sessionID: string): string {
  if (!messages || messages.length === 0) {
    return `会话 ${sessionID.slice(0, 8)}`
  }
  const firstUserMessage = messages.find((m) => m.role === "user")
  if (!firstUserMessage) {
    return `会话 ${sessionID.slice(0, 8)}`
  }
  const parts = firstUserMessage.parts || []
  const textPart = parts.find((p: any) => p.type === "text")
  if (textPart && textPart.content) {
    const content = textPart.content.trim()
    return content.length > 30 ? content.slice(0, 30) + "..." : content
  }
  return `会话 ${sessionID.slice(0, 8)}`
}

/**
 * SkillsPage - 技能管理页面
 * 基于frame: 8RFbt (技能管理)
 */
export function SkillsPage() {
  const navigate = useNavigate()
  const params = useParams<{ dir: string }>()
  const dialog = useDialog()
  const sync = useSync()
  const globalSync = useGlobalSync()
  const sdk = useGlobalSDK()

  // 过滤后的技能列表 - 只显示配置路径下的技能
  const filteredSkills = createMemo(() => {
    const skills = globalSync.data.skills
    const pathsInfo = sync.data.path
    const configPaths = sync.data.config.skills?.paths ?? []

    if (!skills || skills.length === 0) return []

    // 如果没有配置路径，显示所有技能
    if (configPaths.length === 0) return skills

    if (!pathsInfo) return []

    const allowedPrefixes = configPaths.map((p: string) => {
      if (p.startsWith("~/")) {
        return pathsInfo.home + p.slice(1)
      }
      if (p.startsWith("/")) return p
      // Relative path
      return pathsInfo.directory + "/" + p
    })

    return skills.filter((skill: any) => {
      return allowedPrefixes.some((prefix: string) => skill.location.startsWith(prefix))
    })
  })

  // 技能卡片数据 - 结合技能列表和启用状态
  const skills = createMemo<SkillCard[]>(() => {
    const list = filteredSkills()
    const enabled = (sync.data.config.skills as any)?.enabled ?? {}

    return list.map((skill: any) => ({
      id: skill.name,
      name: skill.name,
      description: skill.description || "",
      enabled: enabled[skill.name] !== false,
      location: skill.location,
    }))
  })

  // 会话列表 - 从sync获取真实数据
  const sessions = createMemo(() => sync.data.session || [])

  // 历史任务列表（排除new）
  const historySessions = createMemo(() => {
    return sessions()
      .filter((s) => s.id !== "new")
      .map((session) => {
        const messages = sync.data.message[session.id]
        return {
          id: session.id,
          title: extractSessionTitle(messages, session.id),
        }
      })
  })

  function handleNewTask() {
    navigate(`/${params.dir}/session/new`)
  }

  function handleSkills() {
    // 已经在技能管理页面，不需要跳转
  }

  function handleSessionClick(sessionID: string) {
    navigate(`/${params.dir}/session/${sessionID}`)
  }

  function handleSettings() {
    dialog.show(() => <DialogSettings />)
  }

  async function toggleSkill(name: string) {
    const enabled = (sync.data.config.skills as any)?.enabled ?? {}
    const newEnabled = { ...enabled, [name]: enabled[name] === false }

    // 抑制事件，防止界面闪烁
    globalSync.suppressNextDisposal()

    // Optimistic update and persist
    try {
      await globalSync.updateConfig({
        ...sync.data.config,
        skills: {
          ...sync.data.config.skills,
          enabled: newEnabled,
        },
      })
    } catch (error) {
      // Error will be handled by updateConfig
      console.error("Failed to toggle skill", error)
    }
  }

  return (
    <div class="flex h-screen w-screen bg-[#FAFAFA]">
      {/* 左侧面板 */}
      <aside class="flex h-full w-[280px] flex-col bg-white">
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

          {/* 技能管理按钮 - 高亮状态（当前页面） */}
          <button
            class="flex items-center gap-3 h-11 px-3 rounded-lg bg-[#DDD6FE]"
            onClick={handleSkills}
          >
            <Icon name="sparkles" size="normal" class="text-[#A855F7]" />
            <span class="font-['Inter'] text-sm font-medium text-[#1E293B]">技能管理</span>
          </button>

          {/* 历史任务 - 显示真实数据 */}
          <Show when={historySessions().length > 0}>
            <div class="mt-4">
              <span class="font-['Inter'] text-xs font-semibold text-[#475569] tracking-wider">历史任务</span>
              <div class="mt-3 flex flex-col gap-1">
                <For each={historySessions()}>
                  {(session) => (
                    <button
                      class="flex items-center gap-3 h-9 px-3 rounded-lg w-full text-left hover:bg-[#F8F7FF] transition-colors"
                      onClick={() => handleSessionClick(session.id)}
                    >
                      <div class="w-0.5 h-5 rounded-full bg-transparent" />
                      <Icon name="clock" size="small" class="text-[#64748B]" />
                      <span class="font-['Inter'] text-sm font-normal text-[#64748B] truncate">{session.title}</span>
                    </button>
                  )}
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

      {/* 主内容区域 */}
      <main class="flex-1 flex flex-col bg-white p-6 overflow-y-auto">
        {/* 标题 */}
        <div class="flex items-center h-15 mb-5">
          <h1 class="font-['Inter'] text-2xl font-bold text-[#334155]">技能管理</h1>
        </div>

        {/* 技能卡片列表 */}
        <div class="flex flex-col gap-3">
          <For each={skills()}>
            {(skill) => (
              <div class="flex flex-col gap-3 p-4 rounded-xl bg-[#EDE9FE]">
                <div class="flex items-center justify-between gap-3">
                  <span class="font-['Inter'] text-base font-semibold !text-[#1F2937]">{skill.name}</span>
                  <div
                    onClick={() => toggleSkill(skill.name)}
                    style={{
                      position: "relative",
                      width: "44px",
                      height: "24px",
                      "border-radius": "12px",
                      "background-color": skill.enabled ? "#7C3AED" : "#E5E7EB",
                      cursor: "pointer",
                      "transition": "background-color 0.2s ease-in-out"
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: "2px",
                        top: "2px",
                        width: "20px",
                        height: "20px",
                        "border-radius": "50%",
                        "background-color": "#FFFFFF",
                        "box-shadow": "0 1px 3px rgba(0,0,0,0.2)",
                        "transition": "transform 0.2s ease-in-out",
                        "transform": skill.enabled ? "translateX(20px)" : "translateX(0px)"
                      }}
                    />
                  </div>
                </div>
                <span class="font-['Inter'] text-sm text-[#64748B]">{skill.description}</span>
              </div>
            )}
          </For>
          <Show when={skills().length === 0}>
            <div class="text-center py-8 text-[#64748B]">
              <p class="font-['Inter'] text-sm">暂无技能，请在设置中配置技能路径</p>
            </div>
          </Show>
        </div>
      </main>
    </div>
  )
}
