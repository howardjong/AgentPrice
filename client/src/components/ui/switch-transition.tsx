import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface SwitchTransitionProps {
  show: boolean;
  children: React.ReactNode;
  className?: string;
}

export function SwitchTransition({ show, children, className }: SwitchTransitionProps) {
  const [shouldRender, setShouldRender] = useState(show);
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      // Delay setting isVisible to trigger the animation
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      // Delay unmounting the component until animation completes
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-in-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className
      )}
    >
      {children}
    </div>
  );
}
