/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  typescript: {
    // ⚠️ Warnung: Überspringt TypeScript-Fehler-Checks während des Builds
    ignoreBuildErrors: true,
  },
  eslint: {
    // ⚠️ Warnung: Überspringt ESLint während des Builds
    ignoreDuringBuilds: true,
  },
  images: {
    domains: [],
    // Image-Optimierung deaktivieren (kann Build beschleunigen)
    unoptimized: false, // oder true für komplett deaktiviert
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

module.exports = nextConfig