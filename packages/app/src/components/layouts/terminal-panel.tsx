import { For, Show, createMemo, createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useParams } from "@solidjs/router"
import { DragDropProvider, DragDropSensors, DragOverlay, SortableProvider, closestCenter } from "@thisbeyond/solid-dnd"
import type { DragEvent } from "@thisbeyond/solid-dnd"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { Tabs } from "@opencode-ai/ui/tabs"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { useLayout } from "@/context/layout"
import { useTerminal, type LocalPTY } from "@/context/terminal"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { Terminal } from "@/components/terminal"
import { SortableTerminalTab } from "@/components/session"
import { ConstrainDragYAxis, getDraggableId } from "@/utils/solid-dnd"

export function TerminalPanel() {
  const layout = useLayout()
  const terminal = useTerminal()
  const command = useCommand()
  const language = useLanguage()
  const platform = usePlatform()
  const params = useParams()

  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const view = createMemo(() => layout.view(sessionKey))

  const isDesktop = () => platform.platform === "desktop"

  const [store, setStore] = createStore({
    activeTerminalDraggable: undefined as string | undefined,
  })

  createEffect(() => {
    if (view().terminal.opened() && terminal.ready() && terminal.all().length === 0) {
      terminal.new()
    }
  })

  const handleTerminalDragStart = (event: unknown) => {
    const id = getDraggableId(event)
    if (!id) return
    setStore("activeTerminalDraggable", id)
  }

  const handleTerminalDragEnd = () => {
    setStore("activeTerminalDraggable", undefined)
  }

  const handleTerminalDragOver = (event: DragEvent) => {
    const { draggable, droppable } = event
    if (!draggable || !droppable) return
    const currentTabs = terminal.all().map((t: LocalPTY) => t.id)
    const fromIndex = currentTabs.indexOf(draggable.id.toString())
    const toIndex = currentTabs.indexOf(droppable.id.toString())
    if (fromIndex !== toIndex && toIndex !== -1) {
      terminal.move(draggable.id.toString(), toIndex)
    }
  }

  return (
    <Show when={view().terminal.opened()}>
      <div
        id="terminal-panel"
        role="region"
        aria-label={language.t("terminal.title")}
        class="relative w-full flex flex-col shrink-0 border-t border-border-weak-base bg-background-base"
        style={{ height: `${layout.terminal.height()}px` }}
      >
        <ResizeHandle
          direction="vertical"
          size={layout.terminal.height()}
          min={100}
          max={window.innerHeight * 0.6}
          collapseThreshold={50}
          onResize={layout.terminal.resize}
          onCollapse={view().terminal.close}
        />
        <Show
          when={terminal.ready()}
          fallback={
            <div class="flex-1 flex items-center justify-center text-text-weak">
              {language.t("terminal.loading")}
            </div>
          }
        >
          <DragDropProvider
            onDragStart={handleTerminalDragStart}
            onDragEnd={handleTerminalDragEnd}
            onDragOver={handleTerminalDragOver}
            collisionDetector={closestCenter}
          >
            <DragDropSensors />
            <ConstrainDragYAxis />
            <div class="flex flex-col h-full">
              <Tabs
                variant="alt"
                value={terminal.active()}
                onChange={(id) => {
                  terminal.open(id)
                }}
                class="!h-auto !flex-none"
              >
                <Tabs.List class="h-10">
                  <SortableProvider ids={terminal.all().map((t: LocalPTY) => t.id)}>
                    <For each={terminal.all()}>
                      {(pty) => (
                        <SortableTerminalTab
                          terminal={pty}
                          onClose={() => {
                            view().terminal.close()
                          }}
                        />
                      )}
                    </For>
                  </SortableProvider>
                  <div class="h-full flex items-center justify-center">
                    <TooltipKeybind
                      title={language.t("command.terminal.new")}
                      keybind={command.keybind("terminal.new")}
                      class="flex items-center"
                    >
                      <IconButton
                        icon="plus-small"
                        variant="ghost"
                        iconSize="large"
                        onClick={terminal.new}
                        aria-label={language.t("command.terminal.new")}
                      />
                    </TooltipKeybind>
                  </div>
                </Tabs.List>
              </Tabs>
              <div class="flex-1 min-h-0 relative">
                <For each={terminal.all()}>
                  {(pty) => (
                    <div
                      id={`terminal-wrapper-${pty.id}`}
                      class="absolute inset-0"
                      style={{
                        display: terminal.active() === pty.id ? "block" : "none",
                      }}
                    >
                      <Show when={pty.id} keyed>
                        <Terminal
                          pty={pty}
                          onCleanup={terminal.update}
                          onConnectError={() => terminal.clone(pty.id)}
                        />
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>
            <DragOverlay>
              <Show when={store.activeTerminalDraggable}>
                {(draggedId) => {
                  const pty = createMemo(() => terminal.all().find((t: LocalPTY) => t.id === draggedId()))
                  return (
                    <Show when={pty()}>
                      {(t) => (
                        <div class="relative p-1 h-10 flex items-center bg-background-stronger text-14-regular">
                          {(() => {
                            const title = t().title
                            const number = t().titleNumber
                            const match = title.match(/^Terminal (\d+)$/)
                            const parsed = match ? Number(match[1]) : undefined
                            const isDefaultTitle =
                              Number.isFinite(number) && number > 0 && Number.isFinite(parsed) && parsed === number

                            if (title && !isDefaultTitle) return title
                            if (Number.isFinite(number) && number > 0)
                              return language.t("terminal.title.numbered", { number })
                            if (title) return title
                            return language.t("terminal.title")
                          })()}
                        </div>
                      )}
                    </Show>
                  )
                }}
              </Show>
            </DragOverlay>
          </DragDropProvider>
        </Show>
      </div>
    </Show>
  )
}
