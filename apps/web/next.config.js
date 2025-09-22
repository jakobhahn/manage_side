/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  transpilePackages: ['@hans/types', '@hans/utils', '@hans/config'],
}

module.exports = nextConfig
