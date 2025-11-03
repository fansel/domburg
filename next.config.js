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
    instrumentationHook: true, // Aktiviert instrumentation.ts
  },
  webpack: (config, { isServer }) => {
    // Node.js Core-Module als extern behandeln (nur für Server-Build)
    if (isServer) {
      config.externals = config.externals || [];
      
      // Funktion um Node.js-Module als extern zu markieren (inkl. node:-Präfix)
      const markNodeModuleExternal = (moduleName) => {
        return {
          [moduleName]: `commonjs ${moduleName}`,
          [`node:${moduleName}`]: `commonjs ${moduleName}`,
        };
      };
      
      // Füge alle Node.js Core-Module hinzu, die nicht gebundelt werden sollen
      const nodeModules = [
        'http', 'https', 'http2', 'net', 'tls', 'fs', 'path',
        'querystring', 'stream', 'os', 'crypto', 'url', 'util',
        'zlib', 'events', 'buffer', 'assert', 'child_process', 'dns',
        'process', 'cluster', 'module', 'readline', 'repl', 'vm',
      ];
      
      const externalsObj = {};
      nodeModules.forEach(module => {
        Object.assign(externalsObj, markNodeModuleExternal(module));
      });
      
      config.externals.push(externalsObj);
    }
    return config;
  },
}

module.exports = nextConfig