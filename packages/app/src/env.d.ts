interface ImportMetaEnv {
  readonly VITE_OPENCODE_SERVER_HOST: string
  readonly VITE_OPENCODE_SERVER_PORT: string
}

interface Window {
  __OPENCODE_ENV__?: {
    FIXED_PROJECTS?: string
    SHOW_SUBFOLDERS?: string
  }
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
