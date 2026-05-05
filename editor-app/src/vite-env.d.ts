/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CESDK_LICENSE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __CESDK_LICENSE__?: string;
}
