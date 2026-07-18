import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      "follow-redirects": false,
      http: false,
      https: false,
      url: false,
    };
    return config;
  },
};

export default nextConfig;
