import React from 'react';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

const SIZE_MAP: Record<string, string> = {
  xs: 'w-7 h-7',
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-20 h-20',
  xl: 'w-28 h-28',
  '2xl': 'w-36 h-36'
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = ''
}) => {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div 
      className={`relative inline-flex items-center justify-center shrink-0 transition-all duration-300 hover:scale-105 select-none ${sizeClass} ${className}`}
    >
      <img
        src="/logo.png"
        alt="StudySync Avocado Mark"
        className="w-full h-full object-contain filter drop-shadow-[0_2px_12px_rgba(255,255,255,0.08)]"
      />
    </div>
  );
};
