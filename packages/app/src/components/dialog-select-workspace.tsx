import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { Icon } from "@opencode-ai/ui/icon"
import { createMemo, createResource, For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { getFilename, getDirectory } from "@opencode-ai/util/path"
import { FIXED_PROJECTS, SHOW_SUBFOLDERS } from "@/custom"
import { useSDK } from "@/context/sdk"

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

  // 获取当前工作目录
  const currentDirectory = createMemo(() => {
    return props.currentDirectory || sdk.directory
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

  // 创建资源来获取所有目录（包括子文件夹）
  const [allDirectories] = createResource(
    () => FIXED_PROJECTS,
    async (fixedPaths) => {
      const allItems: Array<{ name: string; absolute: string }> = []

      if (fixedPaths.length === 0) {
        // 如果没有配置固定项目，使用当前目录
        const currentDir = currentDirectory()
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
        for (const path of fixedPaths) {
          // 添加父目录本身
          allItems.push({
            name: getFilename(path),
            absolute: path,
          })

          // 如果需要显示子文件夹，扫描并添加
          if (SHOW_SUBFOLDERS) {
            const subfolders = await getSubfolders(path)
            allItems.push(...subfolders.map(sub => ({
              name: `${getFilename(path)}/${sub.name}`,
              absolute: sub.absolute,
            })))
          }
        }
      }

      return allItems
    },
    { initialValue: [] }
  )

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

  // 处理选择
  function handleSelect(path: string) {
    props.onSelect(path)
    dialog.close()
  }

  return (
    <Dialog title={language.t("dialog.workspace.select.title")}>
      <Show
        when={allDirectories().length > 0}
        fallback={<div class="text-center py-4 text-text-weak text-sm">加载中...</div>}
      >
        <div class="flex flex-col max-h-[400px] overflow-y-auto">
          <For each={allDirectories()}>
            {(item) => (
              <button
                onClick={() => handleSelect(item.absolute)}
                classList={{
                  "w-full flex items-center gap-x-3 p-3 rounded-lg mb-2 transition-colors": true,
                  "bg-[#F8F7FF] border border-[#A855F7]": isSelected(item.absolute),
                  "hover:bg-[#F8F7FF] border border-transparent": !isSelected(item.absolute),
                }}
              >
                <div class="shrink-0">
                  <div class="size-10 rounded-full bg-[#EDE9FE] flex items-center justify-center">
                    <Icon name="folder" size="normal" class="text-[#7C3AED]" />
                  </div>
                </div>
                <div class="flex flex-col min-w-0 flex-1 text-left">
                  <div class="flex items-center gap-2">
                    <span class="text-14-regular text-text-strong font-medium truncate">
                      {getWorkspaceLabel(item)}
                    </span>
                    <Show when={isSelected(item.absolute)}>
                      <span class="text-11-regular text-white px-1.5 py-0.5 bg-[#A855F7] rounded">
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
        </div>
      </Show>
    </Dialog>
  )
}
