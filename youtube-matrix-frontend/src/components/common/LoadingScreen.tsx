import React from 'react';
import { Spin } from 'antd';
import Logo from './Logo';

interface LoadingScreenProps {
  tip?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ tip = 'Loading...' }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <Logo size="large" className="mb-8" />
      <Spin size="large" tip={tip} />
    </div>
  );
};

export default LoadingScreen;
