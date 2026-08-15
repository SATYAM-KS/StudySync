import React, { useState } from 'react';

export function getInitials(name?: string): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

const SIZE_MAP: Record<AvatarSize, { container: string; text: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]' },
  sm: { container: 'w-8 h-8', text: 'text-xs' },
  md: { container: 'w-9 h-9', text: 'text-xs' },
  lg: { container: 'w-10 h-10', text: 'text-sm' },
  xl: { container: 'w-12 h-12', text: 'text-base' },
  '2xl': { container: 'w-16 h-16', text: 'text-xl' },
  '3xl': { container: 'w-20 h-20', text: 'text-2xl' }
};

interface UserAvatarProps {
  name?: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  rounded?: 'full' | 'lg' | 'xl' | '2xl';
  className?: string;
  imgClassName?: string;
  alt?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name = '',
  avatarUrl,
  size = 'md',
  rounded = 'xl',
  className = '',
  imgClassName = '',
  alt
}) => {
  const [hasError, setHasError] = useState(false);
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;
  const initials = getInitials(name);

  const roundedClass = 
    rounded === 'full' ? 'rounded-full' :
    rounded === '2xl' ? 'rounded-2xl' :
    rounded === 'lg' ? 'rounded-lg' : 'rounded-xl';

  // Check if avatarUrl is a valid custom URL (ignore legacy unsplash placeholder URLs)
  const isValidUrl = Boolean(
    avatarUrl && 
    avatarUrl.trim() && 
    !avatarUrl.includes('images.unsplash.com') && 
    !hasError
  );

  if (isValidUrl) {
    return (
      <img
        src={avatarUrl!}
        alt={alt || name || 'Avatar'}
        onError={() => setHasError(true)}
        className={`${sizeConfig.container} ${roundedClass} object-cover grayscale ring-1 ring-zinc-300 dark:ring-zinc-700 shrink-0 ${imgClassName} ${className}`}
      />
    );
  }

  // Initials fallback
  return (
    <div
      className={`${sizeConfig.container} ${roundedClass} bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-extrabold flex items-center justify-center select-none shrink-0 border border-zinc-300 dark:border-zinc-700 uppercase tracking-tight ${sizeConfig.text} ${className}`}
      title={name}
      aria-label={name || 'User avatar'}
    >
      {initials}
    </div>
  );
};
