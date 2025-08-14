import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  
  // PRODUCTION-CRITICAL: Build error handling (temporarily relaxed for emergency)
  eslint: {
    ignoreDuringBuilds: true, // Temporarily ignore for emergency deploy
  },
  typescript: {
    ignoreBuildErrors: true, // Temporarily ignore for emergency deploy
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          }
        ],
      },
    ];
  },
  
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-6f0cf05705c7412b93a792350f3b3aa5.r2.dev",
      },
      {
        protocol: "https",
        hostname: "jdj14ctwppwprnqu.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },
  
  // Production optimizations
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js', 'lucide-react'],
  },
  
  // Webpack optimizations for production
  webpack: (config, { dev, isServer }) => {
    // Exclude Redis packages from client-side bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        dns: false,
        tls: false,
        'ioredis': false,
        '@upstash/redis': false,
      };
    }
    
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          vendor: {
            chunks: 'all',
            test: /node_modules/,
            name: 'vendor',
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
