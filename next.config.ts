import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Electron에서 실행할 때를 위한 설정
  output: process.env.ELECTRON_BUILD ? 'standalone' : undefined,

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
