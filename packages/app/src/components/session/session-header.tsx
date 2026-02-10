import { createEffect, createMemo, onCleanup, Show, createSignal, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { Portal } from "solid-js/web"
import { useParams } from "@solidjs/router"
import { useLayout } from "@/context/layout"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useSync } from "@/context/sync"
import { useGlobalSDK } from "@/context/global-sdk"
import { getFilename } from "@opencode-ai/util/path"
import { decode64 } from "@/utils/base64"

import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Button } from "@opencode-ai/ui/button"
import { Tooltip, TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { Popover } from "@opencode-ai/ui/popover"
import { TextField } from "@opencode-ai/ui/text-field"
import { Keybind } from "@opencode-ai/ui/keybind"
import { StatusPopover } from "../status-popover"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DialogSkills } from "@/components/dialog-skills"

export function SessionHeader() {
  const globalSDK = useGlobalSDK()
  const layout = useLayout()
  const params = useParams()
  const command = useCommand()
  const sync = useSync()
  const platform = usePlatform()
  const language = useLanguage()
  const dialog = useDialog()

  const projectDirectory = createMemo(() => decode64(params.dir) ?? "")
  const project = createMemo(() => {
    const directory = projectDirectory()
    if (!directory) return
    return layout.projects.list().find((p) => p.worktree === directory || p.sandboxes?.includes(directory))
  })
  const name = createMemo(() => {
    const current = project()
    if (current) return current.name || getFilename(current.worktree)
    return getFilename(projectDirectory())
  })
  const hotkey = createMemo(() => command.keybind("file.open"))

  const currentSession = createMemo(() => sync.data.session.find((s) => s.id === params.id))
  const shareEnabled = createMemo(() => sync.data.config.share !== "disabled")
  const showShare = createMemo(() => shareEnabled() && !!currentSession())
  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const view = createMemo(() => layout.view(sessionKey))

  const [state, setState] = createStore({
    share: false,
    unshare: false,
    copied: false,
    timer: undefined as number | undefined,
  })
  const shareUrl = createMemo(() => currentSession()?.share?.url)

  createEffect(() => {
    const url = shareUrl()
    if (url) return
    if (state.timer) window.clearTimeout(state.timer)
    setState({ copied: false, timer: undefined })
  })

  onCleanup(() => {
    if (state.timer) window.clearTimeout(state.timer)
  })

  function shareSession() {
    const session = currentSession()
    if (!session || state.share) return
    setState("share", true)
    globalSDK.client.session
      .share({ sessionID: session.id, directory: projectDirectory() })
      .catch((error) => {
        console.error("Failed to share session", error)
      })
      .finally(() => {
        setState("share", false)
      })
  }

  function unshareSession() {
    const session = currentSession()
    if (!session || state.unshare) return
    setState("unshare", true)
    globalSDK.client.session
      .unshare({ sessionID: session.id, directory: projectDirectory() })
      .catch((error) => {
        console.error("Failed to unshare session", error)
      })
      .finally(() => {
        setState("unshare", false)
      })
  }

  function copyLink() {
    const url = shareUrl()
    if (!url) return
    navigator.clipboard
      .writeText(url)
      .then(() => {
        if (state.timer) window.clearTimeout(state.timer)
        setState("copied", true)
        const timer = window.setTimeout(() => {
          setState("copied", false)
          setState("timer", undefined)
        }, 3000)
        setState("timer", timer)
      })
      .catch((error) => {
        console.error("Failed to copy share link", error)
      })
  }

  function viewShare() {
    const url = shareUrl()
    if (!url) return
    platform.openLink(url)
  }

  const [centerMount, setCenterMount] = createSignal<HTMLElement | null>(null)
  const [rightMount, setRightMount] = createSignal<HTMLElement | null>(null)

  onMount(() => {
    setCenterMount(document.getElementById("opencode-titlebar-center"))
    setRightMount(document.getElementById("opencode-titlebar-right"))
  })

  return (
    <>
      <Show when={rightMount()}>
        {(mount) => (
          <Portal mount={mount()}>
            <div class="flex items-center gap-3">
              {/* <Tooltip value={language.t("dialog.skills.title")}>
                <IconButton
                  icon="brain"
                  variant="ghost"
                  onClick={() => dialog.show(() => <DialogSkills />)}
                  aria-label={language.t("dialog.skills.title")}
                />
              </Tooltip> */}
              <StatusPopover />
              {/* <Show when={showShare()}>
                <div class="flex items-center">
                  <Popover
                    title={language.t("session.share.popover.title")}
                    description={
                      shareUrl()
                        ? language.t("session.share.popover.description.shared")
                        : language.t("session.share.popover.description.unshared")
                    }
                    gutter={6}
                    placement="bottom-end"
                    shift={-64}
                    class="rounded-xl [&_[data-slot=popover-close-button]]:hidden"
                    triggerAs={Button}
                    triggerProps={{
                      variant: "secondary",
                      class: "rounded-sm h-[24px] px-3",
                      classList: { "rounded-r-none": shareUrl() !== undefined },
                      style: { scale: 1 },
                    }}
                    trigger={language.t("session.share.action.share")}
                  >
                    <div class="flex flex-col gap-2">
                      <Show
                        when={shareUrl()}
                        fallback={
                          <div class="flex">
                            <Button
                              size="large"
                              variant="primary"
                              class="w-1/2"
                              onClick={shareSession}
                              disabled={state.share}
                            >
                              {state.share
                                ? language.t("session.share.action.publishing")
                                : language.t("session.share.action.publish")}
                            </Button>
                          </div>
                        }
                      >
                        <div class="flex flex-col gap-2">
                          <TextField value={shareUrl() ?? ""} readOnly copyable tabIndex={-1} class="w-full" />
                          <div class="grid grid-cols-2 gap-2">
                            <Button
                              size="large"
                              variant="secondary"
                              class="w-full shadow-none border border-border-weak-base"
                              onClick={unshareSession}
                              disabled={state.unshare}
                            >
                              {state.unshare
                                ? language.t("session.share.action.unpublishing")
                                : language.t("session.share.action.unpublish")}
                            </Button>
                            <Button
                              size="large"
                              variant="primary"
                              class="w-full"
                              onClick={viewShare}
                              disabled={state.unshare}
                            >
                              {language.t("session.share.action.view")}
                            </Button>
                          </div>
                        </div>
                      </Show>
                    </div>
                  </Popover>
                  <Show when={shareUrl()} fallback={<div aria-hidden="true" />}>
                    <Tooltip
                      value={
                        state.copied
                          ? language.t("session.share.copy.copied")
                          : language.t("session.share.copy.copyLink")
                      }
                      placement="top"
                      gutter={8}
                    >
                      <IconButton
                        icon={state.copied ? "check" : "link"}
                        variant="secondary"
                        class="rounded-l-none"
                        onClick={copyLink}
                        disabled={state.unshare}
                        aria-label={
                          state.copied
                            ? language.t("session.share.copy.copied")
                            : language.t("session.share.copy.copyLink")
                        }
                      />
                    </Tooltip>
                  </Show>
                </div>
              </Show> */}
              <div class="hidden md:flex items-center gap-3 ml-2 shrink-0">
                <TooltipKeybind
                  title={language.t("command.terminal.toggle")}
                  keybind={command.keybind("terminal.toggle")}
                >
                  <Button
                    variant="ghost"
                    class="group/terminal-toggle size-6 p-0"
                    onClick={() => view().terminal.toggle()}
                    aria-label={language.t("command.terminal.toggle")}
                    aria-expanded={view().terminal.opened()}
                    aria-controls="terminal-panel"
                  >
                    <div class="relative flex items-center justify-center size-4 [&>*]:absolute [&>*]:inset-0">
                      <Icon
                        size="small"
                        name={view().terminal.opened() ? "layout-bottom-full" : "layout-bottom"}
                        class="group-hover/terminal-toggle:hidden"
                      />
                      <Icon
                        size="small"
                        name="layout-bottom-partial"
                        class="hidden group-hover/terminal-toggle:inline-block"
                      />
                      <Icon
                        size="small"
                        name={view().terminal.opened() ? "layout-bottom" : "layout-bottom-full"}
                        class="hidden group-active/terminal-toggle:inline-block"
                      />
                    </div>
                  </Button>
                </TooltipKeybind>
              </div>
              <div class="hidden md:block shrink-0">
                <TooltipKeybind title={language.t("command.review.toggle")} keybind={command.keybind("review.toggle")}>
                  <Button
                    variant="ghost"
                    class="group/file-tree-toggle size-6 p-0"
                    onClick={() => layout.fileTree.toggle()}
                    aria-label={language.t("command.review.toggle")}
                    aria-expanded={layout.fileTree.opened()}
                    aria-controls="review-panel"
                  >
                    <div class="relative flex items-center justify-center size-4 [&>*]:absolute [&>*]:inset-0">
                      <Icon
                        size="small"
                        name={layout.fileTree.opened() ? "layout-right-full" : "layout-right"}
                        class="group-hover/file-tree-toggle:hidden"
                      />
                      <Icon
                        size="small"
                        name="layout-right-partial"
                        class="hidden group-hover/file-tree-toggle:inline-block"
                      />
                      <Icon
                        size="small"
                        name={layout.fileTree.opened() ? "layout-right" : "layout-right-full"}
                        class="hidden group-active/file-tree-toggle:inline-block"
                      />
                    </div>
                  </Button>
                </TooltipKeybind>
              </div>
            </div>
          </Portal>
        )}
      </Show>
    </>
  )
}
