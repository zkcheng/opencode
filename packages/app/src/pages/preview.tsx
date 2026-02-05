import { createMemo, createResource, Show } from "solid-js"
import { useParams, useSearchParams } from "@solidjs/router"
import { SDKProvider, useSDK } from "@/context/sdk"
import { SyncProvider } from "@/context/sync"
import { LocalProvider } from "@/context/local"
import { decode64 } from "@/utils/base64"
import { marked } from "marked"

function PreviewContent() {
  const [searchParams] = useSearchParams()
  const sdk = useSDK()
  const path = (): string | undefined => {
    const p = searchParams.path
    if (Array.isArray(p)) return p[0]
    return p
  }

  const [content] = createResource(path, async (p) => {
    if (!p) throw new Error("Path is required")
    try {
      const res = await sdk.client.file.read({ path: p })
      if (res.error) throw res.error
      if (!res.data) throw new Error("No data received")
      return res.data.content
    } catch (e) {
      console.error("Failed to read file", e)
      throw e
    }
  })

  const isHtml = () => {
    const p = path()
    if (!p) return false
    return p.endsWith(".html") || p.endsWith(".htm")
  }
  const isMarkdown = () => {
    const p = path()
    if (!p) return false
    return p.endsWith(".md") || p.endsWith(".markdown")
  }

  let markdownContainer: HTMLDivElement | undefined

  return (
    <div class="size-full bg-background-base overflow-auto">
      <Show when={content.loading}>
        <div class="flex items-center justify-center size-full text-text-weak">Loading...</div>
      </Show>
      
      <Show when={content.error}>
        <div class="flex flex-col items-center justify-center size-full text-text-error gap-2 p-4">
          <div class="text-14-medium">Failed to load content</div>
          <div class="text-12-regular opacity-80">{content.error.message}</div>
        </div>
      </Show>

      <Show when={!content.loading && !content.error && content() !== undefined}>
        <div class="size-full">
          <Show when={isHtml()}>
            <iframe
              class="size-full border-none bg-white"
              srcdoc={content()!}
              sandbox="allow-scripts allow-popups allow-forms allow-same-origin"
            />
          </Show>
          <Show when={isMarkdown()}>
            <div class="p-8 max-w-4xl mx-auto">
              <div
                class="prose dark:prose-invert max-w-none"
                ref={(el) => {
                  markdownContainer = el
                  const text = content() || ""
                  Promise.resolve(marked.parse(text)).then((html) => {
                    el.innerHTML = html as string
                  })
                }}
              />
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}

export default function PreviewPage() {
  const params = useParams()
  const directory = createMemo(() => decode64(params.dir) ?? "")

  return (
    <Show when={directory()}>
      <SDKProvider directory={directory()}>
        <SyncProvider>
          <LocalProvider>
            <PreviewContent />
          </LocalProvider>
        </SyncProvider>
      </SDKProvider>
    </Show>
  )
}
