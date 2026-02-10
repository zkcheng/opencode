import { createMemo, For, createSignal, Show } from "solid-js"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { Dialog } from "@opencode-ai/ui/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import { Switch } from "@opencode-ai/ui/switch"
import { useLanguage } from "@/context/language"

export function DialogSkills() {
  const sdk = useGlobalSDK()
  const sync = useGlobalSync()
  const language = useLanguage()
  const [searchQuery, setSearchQuery] = createSignal("")

  const filteredSkills = createMemo(() => {
    const skills = sync.data.skills
    const pathsInfo = sync.data.path
    const configPaths = sync.data.config.skills?.paths ?? []

    if (!skills) return []
    
    // 如果没有配置路径，展示所有技能
    if (configPaths.length === 0) return skills
    if (!pathsInfo) return []

    const allowedPrefixes = configPaths.map((p: string) => {
        if (p.startsWith("~/")) {
            return pathsInfo.home + p.slice(1)
        }
        if (p.startsWith("/")) return p
        return pathsInfo.directory + "/" + p
    })

    const list = skills.filter((skill: any) => {
        return allowedPrefixes.some((prefix: string) => skill.location.startsWith(prefix))
    })

    const query = searchQuery().toLowerCase()
    if (!query) return list

    return list.filter((skill: any) => 
      skill.name.toLowerCase().includes(query) || 
      (skill.description && skill.description.toLowerCase().includes(query))
    )
  })

  return (
    <Dialog title={language.t("dialog.skills.title")}>
      {/* 搜索框 */}
      <div class="my-4 px-4">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon name="magnifying-glass" size="small" class="text-text-weak" />
          </div>
          <input
            type="text"
            placeholder={language.t("dialog.skills.search.placeholder")}
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

      <div class="max-h-[500px] overflow-y-auto px-4 pb-4">
        <div class="grid grid-cols-1 gap-3">
          <For each={filteredSkills()} fallback={
            <div class="text-center py-12 text-text-weak text-sm">
              <Icon name="circle-ban-sign" size="normal" class="mb-2 opacity-50 mx-auto" />
              <div>{language.t("dialog.skills.empty")}</div>
            </div>
          }>
            {(item: any) => {
              const enabled = createMemo(() => {
                const map = (sync.data.config.skills as any)?.enabled ?? {}
                return map[item.name] !== false
              })

              return (
                <div class="group relative flex items-start gap-4 p-4 rounded-xl border border-border-weak-base bg-surface-base hover:bg-surface-base-hover hover:shadow-soft hover:border-primary-base/30 transition-all duration-200">
                  <div class="shrink-0 mt-1">
                    <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-surface-raised-base text-primary-base group-hover:scale-110 transition-transform">
                      <Icon name="sparkles" size="normal" />
                    </div>
                  </div>
                  
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2 mb-1">
                      <span class="font-['Inter'] text-base font-semibold text-text-strong group-hover:text-primary-base transition-colors">{item.name}</span>
                      <Switch
                        checked={enabled()}
                        onChange={(checked) => {
                          const map = (sync.data.config.skills as any)?.enabled ?? {}
                          const newMap = { ...map, [item.name]: checked }
                          
                          if (!sync.data.config.skills) {
                            sync.set("config", "skills", { enabled: newMap })
                          } else {
                            sync.set("config", "skills", "enabled", newMap)
                          }

                          sync.suppressNextDisposal()
                          sdk.client.global.config.update({
                            config: {
                              skills: {
                                enabled: newMap,
                              },
                            },
                          }).catch(() => {
                            sync.set("config", "skills", "enabled", map)
                          })
                        }}
                      />
                    </div>
                    <p class="font-['Inter'] text-sm text-text-weak leading-relaxed line-clamp-2">{item.description}</p>
                    <div class="mt-2 flex items-center gap-2">
                       <span class="text-xs text-text-weaker bg-surface-raised-base px-2 py-0.5 rounded-full font-mono opacity-80">{item.name}</span>
                    </div>
                  </div>
                </div>
              )
            }}
          </For>
        </div>
      </div>
    </Dialog>
  )
}
