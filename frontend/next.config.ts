import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 환경에서 호스트명 허용
  output: "standalone",

  // API 프록시 (개발 시 Nginx 없이 직접 실행할 때 사용)
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_INTERNAL_URL ?? "http://backend:8000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
