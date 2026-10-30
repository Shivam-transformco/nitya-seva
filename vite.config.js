import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the build works on GitHub Pages project URLs and custom domains alike.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
