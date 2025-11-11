import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import devCerts from "office-addin-dev-certs";

function routeAliases(): Plugin {
  return {
    name: "route-aliases",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        try {
          // req.url can look like "/taskpane.html?x=1"
          const u = new URL(req.url || "/", "https://local.dev"); // base origin only for parsing
          const { pathname, search } = u;

          if (pathname === "/taskpane.html" || pathname === "/taskpane") {
            req.url = `/src/taskpane/taskpane.html${search}`;
          } else if (pathname === "/commands.html" || pathname === "/commands") {
            req.url = `/src/commands/commands.html${search}`;
          }
        } catch {
          // ignore malformed URLs
        }
        next();
      });
    },
  };
}

export default defineConfig(async () => {
  const isDeploy = process.env.NODE_ENV === "deployment";

  const buildOptions = {
    outDir: "dist",
    rollupOptions: {
      input: {
        taskpane: resolve(__dirname, "src/taskpane/taskpane.html"),
        commands: resolve(__dirname, "src/commands/commands.html"),
      },
      output: {
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash][extname]",
      },
    },
  };

  const baseServerOptions = {
    port: 3000,
    strictPort: true,
  };

  if (isDeploy) {
    return {
      plugins: [react(), routeAliases()],
      server: baseServerOptions,
      preview: baseServerOptions,
      build: buildOptions,
    };
  } else {
    const httpsOptions = await devCerts.getHttpsServerOptions();
    return {
      plugins: [react(), routeAliases()],
      server: {
        https: httpsOptions,
        ...baseServerOptions,
      },
      preview: {
        https: httpsOptions,
        ...baseServerOptions,
      },
      build: buildOptions,
    };
  }
});
