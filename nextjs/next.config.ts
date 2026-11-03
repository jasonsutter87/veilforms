import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Type-check the app, not the tests: Next 16.4+ checks everything tsconfig.json includes,
  // and the tests are type-checked by vitest's own run.
  typescript: { tsconfigPath: "tsconfig.build.json" },

  // Optimize package imports for better code splitting
  experimental: {
    optimizePackageImports: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
  },

  // Turbopack configuration (empty to silence migration warning)
  turbopack: {},

  // Webpack configuration for code splitting
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Split @dnd-kit into separate chunk
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization?.splitChunks,
          cacheGroups: {
            ...config.optimization?.splitChunks?.cacheGroups,
            dndkit: {
              test: /[\\/]node_modules[\\/]@dnd-kit[\\/]/,
              name: 'dnd-kit',
              chunks: 'all',
              priority: 10,
            },
          },
        },
      };
    }

    return config;
  },
};

export default nextConfig;
