import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { warmPhotosOrigin } from "./utils/preloadImage.js";
import App from "./App.jsx";
import "./styles/global.css";

if (typeof window !== "undefined") {
  warmPhotosOrigin();
}

async function bootstrap() {
  if (import.meta.env.DEV && !String(import.meta.env.VITE_PHOTOS_BASE_URL ?? "").trim()) {
    const { initDevStorePhotos } = await import("./utils/storePhotos.dev-init.js");
    await initDevStorePhotos();
  }

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}

bootstrap();
