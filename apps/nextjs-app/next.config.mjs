// @ts-check

import { readFileSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs'; // https://docs.sentry.io/platforms/javascript/guides/nextjs/
import { createSecureHeaders } from 'next-secure-headers';
import pc from 'picocolors';
import nextI18nConfig from './next-i18next.config.mjs';
import { buildEnv } from './src/config/build-env.config.mjs';
import { getServerRuntimeEnv } from './src/config/server-runtime-env.config.mjs';

// @ts-ignore
import { PrismaPlugin } from '@prisma/nextjs-monorepo-workaround-plugin';

// validate server env
const _serverEnv = getServerRuntimeEnv();

const workspaceRoot = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '..',
  '..'
);

/**
 * Once supported replace by node / eslint / ts and out of experimental, replace by
 * `import packageJson from './package.json' assert { type: 'json' };`
 * @type {import('type-fest').PackageJson}
 */
const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url)).toString('utf-8')
);

const isProd = process.env.NODE_ENV === 'production';

if (!buildEnv.NEXT_BUILD_ENV_SOURCEMAPS) {
  console.log(
    `- ${pc.green(
      'info'
    )} Sourcemaps generation have been disabled through NEXT_BUILD_ENV_SOURCEMAPS`
  );
}

// @link https://github.com/jagaapple/next-secure-headers
const secureHeaders = createSecureHeaders({
  contentSecurityPolicy: {
    directives:
      buildEnv.NEXT_BUILD_ENV_CSP === true
        ? {
            defaultSrc: "'self'",
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              'https://unpkg.com/@graphql-yoga/graphiql/dist/style.css',
              'https://meet.jitsi.si',
              'https://8x8.vc',
            ],
            scriptSrc: [
              "'self'",
              "'unsafe-eval'",
              "'unsafe-inline'",
              'https://unpkg.com/@graphql-yoga/graphiql',
              // 'https://meet.jit.si/external_api.js',
              // 'https://8x8.vc/external_api.js',
            ],
            frameSrc: [
              "'self'",
              // 'https://meet.jit.si',
              // 'https://8x8.vc',
            ],
            connectSrc: [
              "'self'",
              'https://vitals.vercel-insights.com',
              'https://*.sentry.io',
              // 'wss://ws.pusherapp.com',
              // 'wss://ws-eu.pusher.com',
              // 'https://sockjs.pusher.com',
              // 'https://sockjs-eu.pusher.com',
            ],
            imgSrc: ["'self'", 'https:', 'http:', 'data:'],
            workerSrc: ['blob:'],
          }
        : {},
  },
  ...(buildEnv.NEXT_BUILD_ENV_CSP === true &&
  process.env.NODE_ENV === 'production'
    ? {
        forceHTTPSRedirect: [
          true,
          { maxAge: 60 * 60 * 24 * 4, includeSubDomains: true },
        ],
      }
    : {}),
  referrerPolicy: 'same-origin',
});

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: buildEnv.NEXT_BUILD_ENV_SOURCEMAPS === true,
  i18n: nextI18nConfig.i18n,
  optimizeFonts: true,

  httpAgentOptions: {
    // @link https://nextjs.org/blog/next-11-1#builds--data-fetching
    keepAlive: true,
  },

  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: (buildEnv.NEXT_BUILD_ENV_CI ? 3600 : 25) * 1000,
  },

  // @link https://nextjs.org/docs/advanced-features/compiler#minification
  // Sometimes buggy so enable/disable when debugging.
  swcMinify: true,

  compiler: {
    // emotion: true,
  },

  sentry: {
    hideSourceMaps: true,
    // To disable the automatic instrumentation of API route handlers and server-side data fetching functions
    // In other words, disable if you prefer to explicitly handle sentry per api routes (ie: wrapApiHandlerWithSentry)
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#configure-server-side-auto-instrumentation
    autoInstrumentServerFunctions: false,
  },

  // @link https://nextjs.org/docs/basic-features/image-optimization
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    formats: ['image/webp'],
    loader: 'default',
    dangerouslyAllowSVG: false,
    disableStaticImages: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
    unoptimized: false,
  },

  transpilePackages: isProd
    ? [
        'ofetch',
        // i18next is build for modern browsers
        // 'i18next',
        // tailwind-merge contains nullish operator ?.
        // 'tailwind-merge',
      ]
    : [],

  modularizeImports: {
    '@mui/material': {
      transform: '@mui/material/{{member}}',
    },
    '@mui/icons-material': {
      transform: '@mui/icons-material/{{member}}',
    },
    '@mui/styles': {
      transform: '@mui/styles/{{member}}',
    },
    /* if needed
    "@mui/lab": {
      transform: "@mui/lab/{{member}}"
    },
    lodash: {
      transform: 'lodash/{{member}}',
      preventFullImport: true,
    },
    */
  },

  // Standalone build
  // @link https://nextjs.org/docs/advanced-features/output-file-tracing#automatically-copying-traced-files-experimental
  ...(buildEnv.NEXT_BUILD_ENV_OUTPUT === 'standalone'
    ? { output: 'standalone', outputFileTracing: true }
    : {}),

  experimental: {
    // @link https://nextjs.org/docs/advanced-features/output-file-tracing#caveats
    ...(buildEnv.NEXT_BUILD_ENV_OUTPUT === 'standalone'
      ? { outputFileTracingRoot: workspaceRoot }
      : {}),

    // Useful in conjunction with to `output: 'standalone'` and `outputFileTracing: true`
    // to keep lambdas sizes / docker images low when vercel/nft isn't able to
    // drop unneeded deps for you. ie: esbuil-musl, swc-musl... when not actually needed
    //
    // Note that yarn 3+/4 is less impacted thanks to supportedArchitectures.
    // See https://yarnpkg.com/configuration/yarnrc#supportedArchitectures and
    // config example in https://github.com/belgattitude/nextjs-monorepo-example/pull/3582
    // NPM/PNPM might adopt https://github.com/npm/rfcs/pull/519 in the future.
    //
    // Caution: use it with care because you'll have to maintain this over time.
    //
    // How to debug in vercel: set NEXT_DEBUG_FUNCTION_SIZE=1 in vercel env, then
    // check the last lines of vercel build.
    //
    // Related issue: https://github.com/vercel/next.js/issues/42641

    // Caution if using pnpm you might also need to consider that things are hoisted
    // under node_modules/.pnpm/<something variable>. Depends on version
    //
    // outputFileTracingExcludes: {
    //  '*': [
    //    '**/node_modules/@swc/core-linux-x64-gnu/**/*',
    //    '**/node_modules/@swc/core-linux-x64-musl/**/*',
    //    // If you're nor relying on mdx-remote... drop this
    //    '**/node_modules/esbuild/linux/**/*',
    //    '**/node_modules/webpack/**/*',
    //    '**/node_modules/terser/**/*',
    //    // If you're not relying on sentry edge or any weird stuff... drop this too
    //    // https://github.com/getsentry/sentry-javascript/pull/6982
    //    '**/node_modules/rollup/**/*',
    //  ],
    // },

    // Prefer loading of ES Modules over CommonJS
    // @link {https://nextjs.org/blog/next-11-1#es-modules-support|Blog 11.1.0}
    // @link {https://github.com/vercel/next.js/discussions/27876|Discussion}
    esmExternals: true,
    // Experimental monorepo support
    // @link {https://github.com/vercel/next.js/pull/22867|Original PR}
    // @link {https://github.com/vercel/next.js/discussions/26420|Discussion}
    externalDir: true,
  },

  typescript: {
    ignoreBuildErrors: !buildEnv.NEXT_BUILD_ENV_TYPECHECK,
    tsconfigPath: buildEnv.NEXT_BUILD_ENV_TSCONFIG,
  },

  eslint: {
    ignoreDuringBuilds: !buildEnv.NEXT_BUILD_ENV_LINT,
    // dirs: [`${__dirname}/src`],
  },

  async headers() {
    return [
      {
        // All page routes, not the api ones
        source: '/:path((?!api).*)*',
        headers: [
          ...secureHeaders,
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'same-origin' },
        ],
      },
    ];
  },

  // @link https://nextjs.org/docs/api-reference/next.config.js/rewrites
  async rewrites() {
    return [
      /*
      {
        source: `/about-us`,
        destination: '/about',
      },
      */
    ];
  },

  webpack: (config, { webpack, isServer }) => {
    if (!isServer) {
      // Fixes npm packages that depend on `fs` module
      // @link https://github.com/vercel/next.js/issues/36514#issuecomment-1112074589
      config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    }

    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/tree-shaking/
    config.plugins.push(
      new webpack.DefinePlugin({
        __SENTRY_DEBUG__: buildEnv.NEXT_BUILD_ENV_SENTRY_DEBUG,
        __SENTRY_TRACING__: buildEnv.NEXT_BUILD_ENV_SENTRY_TRACING,
      })
    );

    // Nextjs with Prisma 4.11.0+ (helps standalone build in monorepos)
    // https://www.prisma.io/docs/guides/database/troubleshooting-orm/help-articles/nextjs-prisma-client-monorepo
    if (isServer) {
      config.plugins.push(new PrismaPlugin());
    }

    config.module.rules.push({
      test: /\.svg$/,
      issuer: /\.(js|ts)x?$/,
      use: [
        {
          loader: '@svgr/webpack',
          // https://react-svgr.com/docs/webpack/#passing-options
          options: {
            svgo: isProd,
            // @link https://github.com/svg/svgo#configuration
            // svgoConfig: { }
          },
        },
      ],
    });

    return config;
  },
  env: {
    APP_NAME: packageJson.name ?? 'not-in-package.json',
    APP_VERSION: packageJson.version ?? 'not-in-package.json',
    BUILD_TIME: new Date().toISOString(),
  },
};

let config = nextConfig;

if (buildEnv.NEXT_BUILD_ENV_SENTRY_ENABLED === true) {
  // @ts-ignore cause sentry is not always following nextjs types
  config = withSentryConfig(config, {
    // Additional config options for the Sentry Webpack plugin. Keep in mind that
    // the following options are set automatically, and overriding them is not
    // recommended:
    //   release, url, org, project, authToken, configFile, stripPrefix,
    //   urlPrefix, include, ignore
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options.
    // silent: isProd, // Suppresses all logs
    dryRun: buildEnv.NEXT_BUILD_ENV_SENTRY_UPLOAD_DRY_RUN === true,
    silent: buildEnv.NEXT_BUILD_ENV_SENTRY_DEBUG === false,
  });
} else {
  const { sentry, ...rest } = config;
  config = rest;
}

if (process.env.ANALYZE === 'true') {
  config = withBundleAnalyzer({
    enabled: true,
  })(config);
}

export default config;
