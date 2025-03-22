import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TerminalProps {
  content: string[];
  className?: string;
  maxHeight?: string;
}

export function Terminal({ content, className, maxHeight = "h-32" }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when content changes
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [content]);

  return (
    <div 
      ref={terminalRef}
      className={cn(
        "terminal font-mono text-xs p-3 overflow-y-auto",
        maxHeight,
        className
      )}
      style={{
        backgroundColor: "#1E293B",
        borderRadius: "0.5rem",
        color: "#E2E8F0"
      }}
    >
      {content.map((line, index) => (
        <div key={index} className="opacity-80">
          {line}
        </div>
      ))}
      <div className="cursor text-green-300">$</div>
    </div>
  );
}
