/// <reference types="vite/client" />
/// <reference types="chrome" />

declare module '*.css?inline' {
  const css: string;
  export default css;
}
