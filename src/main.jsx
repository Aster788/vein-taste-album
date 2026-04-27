import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import App from "./App.jsx";
import "./styles/global.css";

if (typeof window !== "undefined") {
  mapboxgl.prewarm();
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
  </StrictMode>
);
