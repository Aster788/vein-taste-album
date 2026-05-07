import { motion } from "framer-motion";
import Book from "./Book.jsx";

/**
 * 翻书过渡动画组件
 * 在书架和城市详情页之间创建"书本飞入展开"的过渡效果
 *
 * @param {Object} props
 * @param {Object} props.city - 城市数据对象
 * @param {DOMRect} props.startRect - 书本起始位置的 DOMRect
 * @param {Function} props.onComplete - 动画完成后的回调
 */
export default function BookTransition({ city, startRect, onComplete }) {
  // 计算目标位置（屏幕中央）
  const viewportCenter = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  };

  // 计算起始位置相对于视口中心的偏移
  const startX = startRect.left + startRect.width / 2 - viewportCenter.x;
  const startY = startRect.top + startRect.height / 2 - viewportCenter.y;

  // 计算安全的缩放比例，确保书本不会超出视口高度（留出 10% 边距）
  const maxViewportHeight = window.innerHeight * 0.8;
  const maxScale = Math.min(2.0, maxViewportHeight / startRect.height);
  const midScale = Math.min(1.5, maxScale * 0.75);

  // 动画配置 - 放慢动画，总时长 1.4 秒
  // 第一阶段（0-55%）：飞入到屏幕中央
  // 第二阶段（55-100%）：书本旋转展开并淡出
  return (
    <motion.div
      className="ffj-book-transition-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        perspective: "1200px",
      }}
    >
      {/* 背景淡入 */}
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(4px)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      />

      {/* 书本动画容器 - 添加 data-city 以继承城市 CSS 变量 */}
      <motion.div
        className="ffj-book-transition-book"
        data-city={city.slug}
        style={{
          position: "absolute",
          width: startRect.width,
          height: startRect.height,
          transformStyle: "preserve-3d",
          willChange: "transform, opacity",
        }}
        initial={{
          x: startX,
          y: startY,
          scale: 1,
          rotateY: 0,
          opacity: 1,
        }}
        animate={{
          x: [startX, 0, 0],
          y: [startY, 0, 0],
          scale: [1, midScale, maxScale],
          rotateY: [0, 0, -75],
          opacity: [1, 1, 0],
        }}
        transition={{
          duration: 1.4,
          times: [0, 0.55, 1],
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
        onAnimationComplete={onComplete}
      >
        <Book city={city} isTransitioning />
      </motion.div>
    </motion.div>
  );
}
