import { useNavigate } from "react-router-dom";
import bookshelfBackStripUrl from "../assets/stickers/page/bookshelf-back-strip.webp?url";

/**
 * 城市详情顶栏：书架视口条带缩略图，点击返回首页书架。
 */
export default function BookshelfBackButton({ ariaLabel }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className="ffj-city-bookshelf-back-btn"
      onClick={() => navigate("/")}
      aria-label={ariaLabel}
    >
      <img
        className="ffj-city-bookshelf-back-btn__strip"
        src={bookshelfBackStripUrl}
        alt=""
        width={87}
        height={27}
        decoding="async"
        draggable={false}
      />
    </button>
  );
}
