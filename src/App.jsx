import { Navigate, Route, Routes } from "react-router-dom";
import Bookshelf from "./pages/Bookshelf.jsx";
import CityDetail from "./pages/CityDetail.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Bookshelf />} />
      <Route path="/:citySlug" element={<CityDetail />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
