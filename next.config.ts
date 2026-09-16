import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Every module route now exists, so links are checked at build time.
  typedRoutes: true,
  experimental: {
    // Server Actions handle every mutation in this app; imports stay lean.
    optimizePackageImports: ['lucide-react'],
  },
}

export default nextConfig
