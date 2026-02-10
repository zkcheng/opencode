import { ParentProps, Show, Switch, Match, createMemo, createContext, useContext } from "solid-js"
import { useParams } from "@solidjs/router"
import { useSync } from "@/context/sync"
import { useLayout as useOriginalLayout } from "@/context/layout"
import { useFile } from "@/context/file"
import { Sidebar } from "./sidebar"
import { ChatPanel } from "./chat-panel"
import { WorkspacePanel } from "./workspace-panel"
import { TerminalPanel } from "./terminal-panel"
import { Titlebar } from "@/components/titlebar"

export type ViewMode = "default" | "chat-preview" | "chat-only"

interface MainLayoutProps extends ParentProps {
  viewMode?: ViewMode
  showWorkspace?: boolean
}

/**
 * MainLayout - 基于4个frame设计的主布局组件
 * 整合原有的Context和数据流
 *
 * 视图模式:
 * - default: 默认状态（未开始对话）
 * - chat-preview: 对话状态-预览模式（三栏布局）
 * - chat-only: 对话状态-无预览（两栏布局）
 */
export function MainLayout(props: MainLayoutProps) {
  const params = useParams<{ dir: string; id?: string }>()
  const sync = useSync()
  const file = useFile()
  const layout = useOriginalLayout()

  // 当前会话ID
  const sessionID = () => params.id ?? "new"

  // 是否有活动会话
  const hasActiveSession = createMemo(() => !!params.id && params.id !== "new")

  // 自动确定viewMode
  const autoViewMode = createMemo<ViewMode>(() => {
    if (props.viewMode) return props.viewMode
    if (!hasActiveSession()) return "default"
    // 如果文件树打开，使用chat-preview，否则使用chat-only
    return layout.fileTree.opened() ? "chat-preview" : "chat-only"
  })

  const viewMode = () => autoViewMode()
  const showWorkspace = () => props.showWorkspace ?? true

  return (
    <div class="flex flex-col h-screen w-screen bg-[#FAFAFA]">
      <Titlebar />
      <div class="flex flex-1 min-h-0 w-full">
        {/* 左侧面板 - 280px */}
        <Show when={layout.sidebar.opened()}>
          <Sidebar />
        </Show>

        {/* 中间对话区域 */}
        <ChatPanel viewMode={viewMode()} sessionID={sessionID()} />

        {/* 右侧工作空间 */}
        <Show when={showWorkspace()}>
          <WorkspacePanel />
        </Show>
      </div>
      <TerminalPanel />
    </div>
  )
}
