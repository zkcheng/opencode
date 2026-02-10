import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import { createMemo, For, Show, createSignal, Switch, Match, createEffect } from "solid-js"
import { useLanguage } from "@/context/language"
import { getFilename } from "@opencode-ai/util/path"
import { FIXED_PROJECTS, SHOW_SUBFOLDERS } from "@/custom"
import { useSDK } from "@/context/sdk"

// 全局缓存，避免组件重新挂载时闪烁
// key 用于区分不同的数据源（例如不同的 currentDirectory）
const [globalCache, setGlobalCache] = createSignal<{
  key: string
  items: Array<{ name: string; absolute: string }>
} | null>(null)

interface DialogSelectWorkspaceProps {
  currentDirectory?: string
  onSelect: (workspace: string) => void
}

/**
 * DialogSelectWorkspace - 工作空间选择对话框
 * 允许用户选择 FIXED_PROJECTS 中配置的项目目录作为工作空间
 * 如果 SHOW_SUBFOLDERS 为 true，还会显示每个项目下的子目录
 */
export function DialogSelectWorkspace(props: DialogSelectWorkspaceProps) {
  const dialog = useDialog()
  const language = useLanguage()
  const sdk = useSDK()

  // 搜索状态
  const [searchQuery, setSearchQuery] = createSignal("")

  // 获取当前工作目录
  const currentDirectory = createMemo(() => {
    return props.currentDirectory || sdk.directory
  })

  // 确定当前的缓存 Key
  const cacheKey = createMemo(() => {
    if (FIXED_PROJECTS.length > 0) return "FIXED_PROJECTS"
    // 如果没有固定项目，列表内容依赖于当前目录
    return currentDirectory() || "DEFAULT_ROOT"
  })

  // 从缓存中获取数据
  // 如果缓存存在且 key 匹配，立即返回数据，避免 loading
  const cachedItems = createMemo(() => {
    const cache = globalCache()
    if (cache && cache.key === cacheKey()) {
      return cache.items
    }
    return null
  })

  // 获取子文件夹的函数
  const getSubfolders = async (parentPath: string): Promise<Array<{ name: string; absolute: string }>> => {
    try {
      const result = await sdk.client.file.list({ directory: parentPath, path: "" })
      const subfolders = (result.data || [])
        .filter(node => node.type === "directory")
        .map(node => ({
          name: node.name,
          absolute: node.absolute
        }))
      return subfolders
    } catch (error) {
      console.error(`扫描子文件夹失败: ${parentPath}`, error)
      return []
    }
  }

  // 数据加载逻辑
  // 即使有缓存，也会在后台静默刷新数据，保证数据新鲜度
  createEffect(() => {
    const key = cacheKey()
    const currentDir = currentDirectory()

    const loadData = async () => {
      const fixedPaths = FIXED_PROJECTS
      const allItems: Array<{ name: string; absolute: string }> = []

      if (fixedPaths.length === 0) {
        // 如果没有配置固定项目，使用当前目录
        allItems.push({
          name: getFilename(currentDir),
          absolute: currentDir,
        })

        if (SHOW_SUBFOLDERS) {
          const subfolders = await getSubfolders(currentDir)
          allItems.push(...subfolders.map(sub => ({
            name: `${getFilename(currentDir)}/${sub.name}`,
            absolute: sub.absolute,
          })))
        }
      } else {
        // 并行加载所有路径的子文件夹，提高性能
        const promises = fixedPaths.map(async (path) => {
          const items: Array<{ name: string; absolute: string }> = []
          
          // 添加父目录本身
          items.push({
            name: getFilename(path),
            absolute: path,
          })

          // 如果需要显示子文件夹，扫描并添加
          if (SHOW_SUBFOLDERS) {
            const subfolders = await getSubfolders(path)
            items.push(...subfolders.map(sub => ({
              name: `${getFilename(path)}/${sub.name}`,
              absolute: sub.absolute,
            })))
          }
          
          return items
        })

        // 等待所有并行操作完成
        const results = await Promise.all(promises)
        allItems.push(...results.flat())
      }

      // 更新全局缓存
      setGlobalCache({
        key: key,
        items: allItems
      })
    }

    loadData()
  })

  // 获取工作空间显示名称
  const getWorkspaceLabel = (item: { name: string; absolute: string }) => {
    return item.name
  }

  // 获取工作空间描述（完整路径）
  const getWorkspaceDescription = (item: { name: string; absolute: string }) => {
    return item.absolute
  }

  // 检查是否为当前选中的工作空间
  const isSelected = (path: string) => {
    return path === currentDirectory()
  }

  // 过滤工作空间
  const filteredDirectories = createMemo(() => {
    const query = searchQuery().toLowerCase().trim()
    const directories = cachedItems() || []
    
    if (directories.length === 0) return []
    if (!query) return directories
    
    return directories.filter(item => 
      item.name.toLowerCase().includes(query) || 
      item.absolute.toLowerCase().includes(query)
    )
  })

  // 统一的渲染状态管理
  const displayState = createMemo(() => {
    const items = cachedItems()
    
    // 如果没有缓存数据，显示 loading
    if (!items) return 'loading'
    
    // 如果有数据但为空
    if (items.length === 0) return 'empty'
    
    // 如果有数据且搜索无结果
    if (filteredDirectories().length === 0 && searchQuery()) return 'no-results'
    
    return 'content'
  })

  // 处理选择
  function handleSelect(path: string) {
    props.onSelect(path)
    dialog.close()
  }

  return (
    <Dialog title={language.t("dialog.workspace.select.title")}>
      {/* 搜索框 - 始终显示 */}
      <div class="my-4 px-4">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon name="magnifying-glass" size="small" class="text-text-weak" />
          </div>
          <input
            type="text"
            placeholder="搜索工作空间..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="w-full pl-10 pr-4 py-2 border border-border-base rounded-lg bg-input-base text-text-strong placeholder-text-weak focus:outline-none focus:ring-2 focus:ring-primary-base focus:border-transparent"
          />
          <Show when={searchQuery()}>
            <button
              onClick={() => setSearchQuery("")}
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-text-weak hover:text-text-strong"
            >
              <Icon name="close" size="small" />
            </button>
          </Show>
        </div>
      </div>

      {/* 统一的渲染状态 */}
      <div class="flex flex-col max-h-[320px] overflow-y-auto min-h-[200px]">
        <Switch>
          <Match when={displayState() === 'loading'}>
            <div class="flex flex-col items-center justify-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-base mb-4"></div>
              <div class="text-text-weak text-sm">加载工作空间...</div>
            </div>
          </Match>
          
          <Match when={displayState() === 'empty'}>
            <div class="text-center py-8 text-text-weak text-sm">
              <Icon name="folder" size="normal" class="mb-2 opacity-50" />
              <div>没有找到工作空间</div>
            </div>
          </Match>
          
          <Match when={displayState() === 'no-results'}>
            <div class="text-center py-8 text-text-weak text-sm">
              <Icon name="circle-ban-sign" size="normal" class="mb-2" />
              <div>没有找到匹配的工作空间</div>
              <div class="text-xs mt-1">尝试调整搜索关键词</div>
            </div>
          </Match>
          
          <Match when={displayState() === 'content'}>
            <For each={filteredDirectories()}>
              {(item) => (
                <button
                  onClick={() => handleSelect(item.absolute)}
                  classList={{
                    "w-full flex items-center gap-x-3 p-3 rounded-lg mb-2 transition-colors": true,
                    "bg-surface-base-active border border-primary-base": isSelected(item.absolute),
                    "hover:bg-surface-base-hover border border-transparent": !isSelected(item.absolute),
                  }}
                >
                  <div class="shrink-0">
                    <div class="size-10 rounded-full bg-surface-raised-base flex items-center justify-center">
                      <Icon name="folder" size="normal" class="text-primary-base" />
                    </div>
                  </div>
                  <div class="flex flex-col min-w-0 flex-1 text-left">
                    <div class="flex items-center gap-2">
                      <span class="text-14-regular text-text-strong font-medium truncate">
                        {getWorkspaceLabel(item)}
                      </span>
                      <Show when={isSelected(item.absolute)}>
                        <span class="text-11-regular text-text-invert-strong px-1.5 py-0.5 bg-primary-base rounded">
                          {language.t("dialog.workspace.current.badge")}
                        </span>
                      </Show>
                    </div>
                    <span class="text-12-regular text-text-weak truncate">
                      {getWorkspaceDescription(item)}
                    </span>
                  </div>
                </button>
              )}
            </For>
          </Match>
        </Switch>
      </div>
    </Dialog>
  )
}
