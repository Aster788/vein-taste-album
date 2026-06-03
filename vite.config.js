import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  assetsInclude: [
    "**/*.JPG",
    "**/*.JPEG",
    "**/*.PNG",
    "**/*.WEBP",
    "**/*.HEIC",
    "**/*.heic",
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/mapbox-gl")) return "mapbox-gl";
          if (id.includes("node_modules/heic2any")) return "heic2any";
          if (id.includes("node_modules/framer-motion")) return "framer-motion";
        },
      },
    },
  },
});
