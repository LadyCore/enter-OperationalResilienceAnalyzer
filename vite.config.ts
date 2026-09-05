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
      // SECURITY: never emit source maps in the published bundle. Source maps
      // would let DevTools reconstruct the original src/ files (paths, line
      // numbers and full sources), which is exactly the exposure reported.
      sourcemap: false,
      // The published artifact must be a production build: minified, without
      // the dev plugin (react-refresh + Babel source-location annotations) and
      // without development-only metadata.
      minify: 'esbuild',
    }
  };
});