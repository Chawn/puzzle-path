interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly VITE_MP_WS_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
