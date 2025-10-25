import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone 모드로 빌드 (Electron 배포용 최적화)
  output: 'standalone',

  // 이미지 최적화는 Electron에서 비활성화
  images: {
    unoptimized: process.env.ELECTRON_BUILD === 'true',
  },

  // 개발 모드에서 Fast Refresh 유지
  reactStrictMode: true,

  // Electron 폴더와 dist-electron 폴더를 빌드에서 제외
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        electron: false,
      };
    }
    return config;
  },
};

export default nextConfig;
