import React from 'react';

interface AiSearchSparkleIconProps {
  className?: string;
  size?: number;
}

export function AiSearchSparkleIcon({ className = "w-4 h-4", size }: AiSearchSparkleIconProps) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      {/* Magnifying Lens */}
      <circle 
        cx="9.5" 
        cy="14" 
        r="5.5" 
        stroke="currentColor" 
        strokeWidth="2" 
        fill="none" 
      />
      {/* Magnifying Handle */}
      <path 
        d="M13.5 18L19.5 24" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
      />
      {/* Sparkle 1 (Main Big Sparkle) */}
      <path 
        d="M15 1.5C15 3.7 16.2 4.9 18.4 5.5C16.2 6.1 15 7.3 15 9.5C15 7.3 13.8 6.1 11.6 5.5C13.8 4.9 15 3.7 15 1.5Z" 
        fill="currentColor" 
      />
      {/* Sparkle 2 (Smaller Secondary Sparkle) */}
      <path 
        d="M20 7C20 8.4 20.7 9.1 22.1 9.5C20.7 9.9 20 10.6 20 12C20 10.6 19.3 9.9 17.9 9.5C19.3 9.1 20 8.4 20 7Z" 
        fill="currentColor" 
      />
    </svg>
  );
}
