import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Bookshelf from "./pages/Bookshelf.jsx";

const CityDetail = lazy(() => import("./pages/CityDetail.jsx"));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Bookshelf />} />
      <Route
        path="/:citySlug"
        element={
          <Suspense fallback={null}>
            <CityDetail />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
