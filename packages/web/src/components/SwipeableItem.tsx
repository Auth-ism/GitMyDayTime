import { useRef, useEffect, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate, type HTMLMotionProps } from "framer-motion";
import { Check, Trash2 } from "lucide-react";

interface Props extends HTMLMotionProps<"div"> {
  children: ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
}

const THRESHOLD = 60;
const MAX_SWIPE = 120;
const SPRING = { type: "spring" as const, stiffness: 500, damping: 30 };

export default function SwipeableItem({ children, onSwipeRight, onSwipeLeft, ...motionProps }: Props) {
  const x = useMotionValue(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const direction = useRef<"none" | "h" | "v">("none");
  const innerRef = useRef<HTMLDivElement>(null);

  // Use refs for callbacks to avoid stale closures in the effect
  const onSwipeRightRef = useRef(onSwipeRight);
  const onSwipeLeftRef = useRef(onSwipeLeft);
  onSwipeRightRef.current = onSwipeRight;
  onSwipeLeftRef.current = onSwipeLeft;

  const rightOpacity = useTransform(x, [0, THRESHOLD], [0, 1]);
  const leftOpacity = useTransform(x, [-THRESHOLD, 0], [1, 0]);
  const rightScale = useTransform(x, [0, THRESHOLD], [0.5, 1]);
  const leftScale = useTransform(x, [-THRESHOLD, 0], [1, 0.5]);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      direction.current = "none";
    };

    const handleTouchMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;

      if (direction.current === "none" && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        direction.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      }

      if (direction.current !== "h") return;
      e.preventDefault(); // Prevent page scrolling during horizontal swipe
      e.stopPropagation();

      if (dx > 0 && !onSwipeRightRef.current) return;
      if (dx < 0 && !onSwipeLeftRef.current) return;

      x.set(Math.sign(dx) * Math.min(Math.abs(dx), MAX_SWIPE));
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (direction.current !== "h") {
        direction.current = "none";
        return;
      }
      e.stopPropagation();

      const current = x.get();
      if (current > THRESHOLD && onSwipeRightRef.current) {
        animate(x, 0, SPRING);
        onSwipeRightRef.current();
      } else if (current < -THRESHOLD && onSwipeLeftRef.current) {
        animate(x, 0, SPRING);
        onSwipeLeftRef.current();
      } else {
        animate(x, 0, SPRING);
      }
      direction.current = "none";
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [x]);

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl"
      style={{ touchAction: "pan-y" }}
      {...motionProps}
    >
      {onSwipeRight && (
        <motion.div
          className="absolute inset-y-0 left-0 w-20 flex items-center justify-center pointer-events-none"
          style={{ opacity: rightOpacity }}
        >
          <motion.div style={{ scale: rightScale }}>
            <div className="w-9 h-9 rounded-full bg-success/20 flex items-center justify-center">
              <Check size={16} className="text-success" />
            </div>
          </motion.div>
        </motion.div>
      )}

      {onSwipeLeft && (
        <motion.div
          className="absolute inset-y-0 right-0 w-20 flex items-center justify-center pointer-events-none"
          style={{ opacity: leftOpacity }}
        >
          <motion.div style={{ scale: leftScale }}>
            <div className="w-9 h-9 rounded-full bg-danger/20 flex items-center justify-center">
              <Trash2 size={16} className="text-danger" />
            </div>
          </motion.div>
        </motion.div>
      )}

      <motion.div
        ref={innerRef}
        style={{ x, touchAction: "pan-y" }}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
