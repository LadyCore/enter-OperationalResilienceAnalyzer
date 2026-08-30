import { defineConfig, PluginOption } from "vite";
import { enterDevPlugin, enterProdPlugin } from 'vite-plugin-enter-dev';
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const plugins = [
    ...enterProdPlugin({ injectGoogleFonts: false }),
  ];
  if (mode === 'development') {
    plugins.push(...enterDevPlugin());
  }
  return {
    server: {
      host: "::",
      port: 8080,
      // Pre-transform the entry graph in the background so the first page load
      // right after a dev-server restart is served without waiting on module
      // transforms (reduces the cold-start window the preview probe can hit).
      warmup: {
        clientFiles: ["/src/main.tsx", "/src/index.css"],
      },
    },
    // Pre-bundle the startup dependencies at server start (instead of on the
    // first request) so @vite/client and /src/main.tsx resolve immediately
    // after a dev-server restart.
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react-router-dom",
        "@tanstack/react-query",
        "i18next",
        "react-i18next",
        "i18next-http-backend",
        "i18next-browser-languagedetector",
        "@supabase/supabase-js",
        "@enter-pro/analytics-sdk",
        "lucide-react",
        "sonner",
        "next-themes",
        "class-variance-authority",
        "clsx",
        "tailwind-merge",
      ],
    },
    plugins: plugins.filter(Boolean) as PluginOption[],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    base: '/',
    build: {
      outDir: 'dist',
    }
  };
});