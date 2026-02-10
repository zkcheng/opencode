/**
 * session.tsx - 会话页面
 *
 * 使用新的MainLayout组件，基于4个frame设计：
 * - Sidebar (280px): 会话历史和导航
 * - ChatPanel: 对话界面（欢迎页或消息列表）
 * - WorkspacePanel (600px): 工作空间（文件树和代码预览）
 *
 * 功能对应关系：
 * - 原来左侧边栏 → 新的Sidebar
 * - 原来的会话 → 新建任务 + 历史任务
 * - 原来的设置 → 设置按钮
 * - 原来的新增项目 → PromptInput中的文件关联功能
 */

import { Show, createEffect, onMount, createMemo, onCleanup, on } from "solid-js"
import { useParams } from "@solidjs/router"
import { useSync } from "@/context/sync"
import { useFile } from "@/context/file"
import { useLayout } from "@/context/layout"
import { useSDK } from "@/context/sdk"
import { MainLayout } from "@/components/layouts/main-layout"
import { SessionHeader } from "@/components/session/session-header"

export default function Page() {
  const params = useParams<{ dir: string; id?: string }>()
  const sync = useSync()
  const file = useFile()
  const layout = useLayout()
  const sdk = useSDK()

  // 会话ID
  const sessionID = () => params.id ?? "new"

  // 组件挂载时，同步会话数据
  createEffect(() => {
    const id = sessionID()
    if (id !== "new" && sync.ready) {
      sync.session.sync(id)
    }
  })

  // 组件挂载时，加载根目录文件列表
  onMount(() => {
    if (sdk.directory) {
      file.tree.list("")
    }
  })

  // 当目录变化时，重新加载文件树
  createEffect(
    on(
      () => sdk.directory,
      (dir) => {
        if (dir) {
          console.log("目录已变化，刷新文件树:", dir)
          file.tree.list("")
        }
      },
      { defer: true },
    ),
  )

  // 组件卸载时的清理
  onCleanup(() => {
    // 清理逻辑可以在这里添加
  })

  return (
    <Show when={sync.ready}>
      <SessionHeader />
      <MainLayout />
    </Show>
  )
}
