// Vite "?raw" imports (used to read the root wrangler.toml in tests).
declare module '*?raw' {
  const content: string;
  export default content;
}
