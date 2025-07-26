import React from 'react';
import { PlayCircleFilled } from '@ant-design/icons';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 'medium', showText = true, className = '' }) => {
  const sizes = {
    small: {
      icon: 24,
      text: 'text-lg',
    },
    medium: {
      icon: 32,
      text: 'text-2xl',
    },
    large: {
      icon: 48,
      text: 'text-4xl',
    },
  };

  const currentSize = sizes[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <PlayCircleFilled style={{ fontSize: currentSize.icon, color: '#FF0000' }} />
      {showText && (
        <span
          className={`font-bold ${currentSize.text} bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent`}
        >
          YouTube Matrix
        </span>
      )}
    </div>
  );
};

export default Logo;
