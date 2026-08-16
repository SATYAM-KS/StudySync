import React from 'react';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  rounded?: string;
}

const SIZE_MAP: Record<string, string> = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-14 h-14',
  '2xl': 'w-20 h-20'
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = '',
  rounded = 'rounded-xl'
}) => {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div 
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden ${sizeClass} ${rounded} shadow-xs transition-transform duration-200 hover:scale-105 select-none ${className}`}
    >
      <img
        src="/logo.png"
        alt="StudySync Logo"
        className="w-full h-full object-contain dark:invert-0 invert transition-all duration-300"
      />
    </div>
  );
};
