// @lovable.dev/vite-tanstack-config already includes tanstackStart, viteReact,
// tailwindcss, tsConfigPaths, VITE_* env injection, @ path alias, React/TanStack
// dedupe, error logger plugins, and sandbox detection.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// Vercel deploys TanStack Start through Nitro. The Lovable config includes
// Cloudflare on production builds by default, so disable it for Vercel builds.
export default defineConfig({
  cloudflare: false,
  plugins: [nitro()],
  tanstackStart: {
    server: { entry: "server" },
  },
});
