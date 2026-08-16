import React from 'react';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

const SIZE_MAP: Record<string, string> = {
  xs: 'w-6 h-6',
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-16 h-16 sm:w-20 sm:h-20',
  xl: 'w-24 h-24 sm:w-28 sm:h-28',
  '2xl': 'w-32 h-32 sm:w-40 sm:h-40'
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = ''
}) => {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div 
      className={`relative inline-flex items-center justify-center shrink-0 transition-transform duration-300 hover:scale-110 select-none text-white ${sizeClass} ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]"
      >
        {/* Avocado Stem & Leaf */}
        <path
          d="M50 14 C48 7 54 3 58 3 C57 7 53 10 50 14 Z"
          fill="currentColor"
        />
        <path
          d="M55 5 C62 5 66 9 65 14 C60 14 56 10 55 5 Z"
          fill="currentColor"
          fillOpacity="0.85"
        />

        {/* Avocado Outer Body with Inner Seed (Pit) Cutout */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M50 14
             C39 14 32 26 30 38
             C28 47 18 57 18 71
             C18 85 32 96 50 96
             C68 96 82 85 82 71
             C82 57 72 47 70 38
             C68 26 61 14 50 14 Z
             M50 54
             C42.27 54 36 60.27 36 68
             C36 75.73 42.27 82 50 82
             C57.73 82 64 75.73 64 68
             C64 60.27 57.73 54 50 54 Z"
          fill="currentColor"
        />

        {/* Central Pit Core Accent Ring */}
        <circle
          cx="50"
          cy="68"
          r="10"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray="4 2"
          fill="none"
          opacity="0.4"
        />
      </svg>
    </div>
  );
};
