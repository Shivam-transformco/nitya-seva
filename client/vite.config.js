import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const page = (p) => fileURLToPath(new URL(p, import.meta.url));

// Vite only serves portal/index.html at "/portal/"; send "/portal" there too (vercel.json does the same in production).
function portalTrailingSlash() {
  const redirect = (req, res, next) => {
    const [path, query] = (req.url ?? "").split("?");
    if (path !== "/portal") return next();
    res.statusCode = 301;
    res.setHeader("Location", `/portal/${query ? `?${query}` : ""}`);
    res.end();
  };
  return {
    name: "portal-trailing-slash",
    configureServer(server) {
      server.middlewares.use(redirect);
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirect);
    },
  };
}

// Relative base so the build works on GitHub Pages project URLs and custom domains alike.
export default defineConfig({
  base: "./",
  plugins: [react(), portalTrailingSlash()],
  build: {
    rollupOptions: {
      // The staff portal is a separate page so none of its code ships with the public site.
      input: { main: page("./index.html"), portal: page("./portal/index.html") },
    },
  },
});
