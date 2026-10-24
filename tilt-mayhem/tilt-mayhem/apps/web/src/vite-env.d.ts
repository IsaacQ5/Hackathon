/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public URL phones should open; defaults to the current origin. */
  readonly VITE_PUBLIC_URL?: string;
  /** Socket.IO server URL when it is on a different origin. */
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
