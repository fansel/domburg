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
  // Kompilierungs-Optimierungen
  compiler: {
    // Deaktiviere entfernte console.logs im Production Build (spart etwas)
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
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
      
      // node-cron als extern markieren (wird zur Laufzeit geladen, spart Build-Speicher)
      // WICHTIG: Bei standalone output werden node_modules kopiert, also wird es zur Laufzeit verfügbar sein
      config.externals.push({
        'node-cron': 'commonjs node-cron',
      });
    }
    
    // Memory-Optimierungen für Build
    if (process.env.NODE_ENV === 'production') {
      // Reduziere Webpack Cache für weniger Speicher
      config.cache = {
        ...config.cache,
        maxMemoryGenerations: 1,
      };
    }
    
    return config;
  },
  // Deaktiviere Source Maps im Production Build (spart viel Speicher/Zeit)
  productionBrowserSourceMaps: false,
  // Security Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-inline für Next.js notwendig
              "style-src 'self' 'unsafe-inline'", // unsafe-inline für Tailwind/Next.js
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; ')
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig