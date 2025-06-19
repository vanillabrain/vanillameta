const CracoAlias = require('craco-alias');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const { InjectManifest } = require('workbox-webpack-plugin');
const path = require('path');

module.exports = {
  plugins: [
    {
      plugin: CracoAlias,
      options: {
        source: 'tsconfig',
        tsConfigPath: './tsconfig.paths.json',
      },
    },
  ],
  webpack: {
    configure: webpackConfig => {
      // Tree shaking 최적화
      webpackConfig.optimization.usedExports = true;
      webpackConfig.optimization.sideEffects = false;
      
      // 청크 분할 설정
      webpackConfig.optimization.splitChunks = {
        chunks: 'all',
        maxInitialRequests: Infinity,
        minSize: 20000,
        cacheGroups: {
          // 큰 라이브러리들을 별도 청크로 분리
          mui: {
            test: /[\\/]node_modules[\\/]@mui[\\/]/,
            name: 'mui',
            priority: 20,
          },
          echarts: {
            test: /[\\/]node_modules[\\/](echarts|echarts-for-react|echarts-gl|claygl)[\\/]/,
            name: 'echarts',
            priority: 20,
          },
          ace: {
            test: /[\\/]node_modules[\\/]ace-builds[\\/]/,
            name: 'ace-editor',
            priority: 20,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            priority: 10,
          },
          common: {
            name: 'common',
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
            enforce: true,
          },
        },
      };

      // 런타임 청크 설정
      webpackConfig.optimization.runtimeChunk = 'single';
      
      // 모듈 ID 최적화
      webpackConfig.optimization.moduleIds = 'deterministic';

      // webpack-bundle-analyzer 설정
      if (process.env.ANALYZE) {
        webpackConfig.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'server',
            analyzerPort: 8888,
            openAnalyzer: true,
          })
        );
      }

      // Service Worker 설정 (InjectManifest)
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction) {
        webpackConfig.plugins.push(
          new InjectManifest({
            swSrc: path.resolve(__dirname, 'src/service-worker.ts'),
            swDest: 'service-worker.js',
            dontCacheBustURLsMatching: /\.\w{8}\./,
            exclude: [/\.map$/, /asset-manifest\.json$/, /LICENSE/],
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
          })
        );
      }

      return webpackConfig;
    },
  },
};
