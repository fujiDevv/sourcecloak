/// <reference types="chrome" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_PRO_UNLOCK?: string;
  readonly VITE_LS_LICENSE_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
