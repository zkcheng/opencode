import { createMemo } from "solid-js"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { Dialog } from "@opencode-ai/ui/dialog"
import { List } from "@opencode-ai/ui/list"
import { Switch } from "@opencode-ai/ui/switch"
import { useLanguage } from "@/context/language"

// Define types locally if not available in SDK yet, or we'll rely on inference
// Based on backend: { name: string, description: string, location: string, content: string }

export function DialogSkills() {
  const sdk = useGlobalSDK()
  const sync = useGlobalSync()
  const language = useLanguage()

  const filteredSkills = createMemo(() => {
    const skills = sync.data.skills
    const pathsInfo = sync.data.path
    const configPaths = sync.data.config.skills?.paths ?? []

    if (!skills) return []
    
    // If no custom paths configured, maybe show nothing? Or show all?
    // Requirement: "展示并管理这些路径下“实际被发现的 Skills 列表”"
    // "Config.skills.paths 的配置入口移动到设置... Skills 管理入口专注于展示这些路径下扫描出来的 skills"
    // This implies we should ONLY show skills from these paths.
    
    if (configPaths.length === 0) return [] 
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

  return (
    <Dialog title={language.t("dialog.skills.title")}>
       <List
          items={filteredSkills()}
          key={(s: any) => s.name}
          search={{ placeholder: language.t("dialog.skills.search.placeholder"), autofocus: true }}
          emptyMessage={language.t("dialog.skills.empty")}
       >
          {(item: any) => {
            const enabled = createMemo(() => {
              const map = (sync.data.config.skills as any)?.enabled ?? {}
              return map[item.name] !== false
            })

            return (
              <div class="flex items-center justify-between gap-4 py-1 w-full">
                <div class="flex flex-col gap-0.5 min-w-0">
                  <span class="text-14-medium text-text-strong">{item.name}</span>
                  <span class="text-12-regular text-text-weak line-clamp-2">{item.description}</span>
                </div>
                <div class="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={enabled()}
                     onChange={(checked) => {
                       const map = (sync.data.config.skills as any)?.enabled ?? {}
                       const newMap = { ...map, [item.name]: checked }
                       
                       // Optimistic update
                       if (!sync.data.config.skills) {
                         sync.set("config", "skills", { enabled: newMap })
                       } else {
                         sync.set("config", "skills", "enabled", newMap)
                       }

                       // Persist
                       sync.suppressNextDisposal()
                       sdk.client.global.config.update({
                         config: {
                           skills: {
                             enabled: newMap,
                           },
                         },
                       }).catch(() => {
                         // Revert on error
                         sync.set("config", "skills", "enabled", map)
                       })
                     }}
                   />
                </div>
              </div>
            )
          }}
       </List>
    </Dialog>
  )
}
