/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: false,
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

    return [
      {
        source: '/backend-api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ]
  },
  env: process.env.NEXT_PUBLIC_API_URL
    ? { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL }
    : {},
}

module.exports = nextConfig
