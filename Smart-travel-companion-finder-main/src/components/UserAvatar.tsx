import { useState } from 'react';

interface UserAvatarProps {
  src?: string;
  name: string;
  className?: string;
}

export default function UserAvatar({ src, name, className = '' }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        className={`object-cover ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <img
      src="/default-avatar.svg"
      alt={name}
      className={`object-cover ${className}`}
    />
  );
}
