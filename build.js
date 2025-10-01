/**
 * 自定義 esbuild 配置 - 支援 TypeScript 路徑別名
 *
 * 此腳本為 Cloudflare Workers 提供 TypeScript 路徑別名解析
 * 參考 tsconfig.json 中的 paths 配置
 */

import * as esbuild from 'esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 路徑別名映射（對應 tsconfig.json）
const pathAliases = {
  '@modules': path.resolve(__dirname, 'src/modules'),
  '@shared': path.resolve(__dirname, 'src/shared'),
  '@infrastructure': path.resolve(__dirname, 'src/infrastructure'),
  '@auth': path.resolve(__dirname, 'src/modules/auth'),
  '@conversations': path.resolve(__dirname, 'src/modules/conversations'),
  '@teams': path.resolve(__dirname, 'src/modules/teams'),
  '@customer': path.resolve(__dirname, 'src/modules/customer'),
  '@integrations': path.resolve(__dirname, 'src/modules/integrations'),
  '@real-time': path.resolve(__dirname, 'src/modules/real-time'),
  '@messaging': path.resolve(__dirname, 'src/modules/messaging'),
  '@analytics': path.resolve(__dirname, 'src/modules/analytics'),
  '@file-management': path.resolve(__dirname, 'src/modules/file-management'),
};

// 路徑別名解析插件
const pathAliasPlugin = {
  name: 'path-alias',
  setup(build) {
    // 處理所有以 @ 開頭的導入
    build.onResolve({ filter: /^@/ }, (args) => {
      for (const [alias, aliasPath] of Object.entries(pathAliases)) {
        if (args.path === alias || args.path.startsWith(alias + '/')) {
          const relativePath = args.path.substring(alias.length);
          const resolvedPath = path.join(aliasPath, relativePath);
          return { path: resolvedPath };
        }
      }
      return null;
    });
  },
};

async function build() {
  try {
    console.log('🔨 Building with TypeScript path aliases support...');

    await esbuild.build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      outfile: 'dist/index.js',
      format: 'esm',
      platform: 'node',
      target: 'es2022',
      sourcemap: true,
      external: ['cloudflare:*'], // Cloudflare Workers 內建模組
      plugins: [pathAliasPlugin],
      logLevel: 'info',
    });

    console.log('✅ Build completed successfully!');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// 如果直接運行此腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  build();
}

export { build, pathAliasPlugin };