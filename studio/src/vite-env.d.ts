/// <reference types="vite/client" />

declare module '*.engine.js?raw' {
  const src: string;
  export default src;
}

declare module './registry.data.js' {
  export const EFFECTS: Record<string, import('./types').RawEffect>;
}
