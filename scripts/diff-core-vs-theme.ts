#!/usr/bin/env npx tsx
/**
 * Compare this theme's Magento_* overrides to vendor/magento core files.
 * Use after Magento upgrades to see drift vs upstream (templates, layout, web/js, etc.).
 *
 * Usage:
 *   npm run diff:core
 *   npm run diff:core -- --module Magento_Catalog
 *   npm run diff:core -- --json
 *   MAGENTO_VENDOR_PATH=/path/to/vendor/magento npm run diff:core
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { glob } from 'glob';

const THEME_ROOT = path.resolve(__dirname, '..');
const DEFAULT_VENDOR = path.resolve(THEME_ROOT, '../../vendor/magento');

const BINARY_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.pdf',
  '.mp4',
  '.webm',
]);

function themeModuleDirToPackageName(themeModuleDir: string): string {
  const rest = themeModuleDir.replace(/^Magento_/, '');
  const kebab = rest
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
  return `module-${kebab}`;
}

/** Map path relative to Magento_X/ to path under module package (frontend storefront). */
function themeRelativeToCoreModuleRelative(relFromModule: string): string | null {
  if (relFromModule.startsWith('templates/')) {
    return path.posix.join('view/frontend', relFromModule);
  }
  if (relFromModule.startsWith('web/')) {
    return path.posix.join('view/frontend', relFromModule);
  }
  if (relFromModule.startsWith('layout/')) {
    return path.posix.join('view/frontend', relFromModule);
  }
  if (relFromModule.startsWith('page_layout/')) {
    return path.posix.join('view/frontend', relFromModule);
  }
  if (relFromModule.startsWith('ui_component/')) {
    return path.posix.join('view/frontend', relFromModule);
  }
  if (relFromModule.startsWith('etc/')) {
    return relFromModule;
  }
  if (relFromModule.startsWith('i18n/')) {
    return relFromModule;
  }
  if (relFromModule === 'requirejs-config.js') {
    return path.posix.join('view/frontend', 'requirejs-config.js');
  }
  return null;
}

function isBinaryPath(filePath: string): boolean {
  return BINARY_EXT.has(path.extname(filePath).toLowerCase());
}

function parseArgs(argv: string[]): {
  json: boolean;
  stat: boolean;
  moduleFilter: string | null;
  maxDiffLines: number;
  help: boolean;
} {
  let json = false;
  let stat = false;
  let moduleFilter: string | null = null;
  let maxDiffLines = 400;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      help = true;
    } else if (a === '--json') {
      json = true;
    } else if (a === '--stat') {
      stat = true;
    } else if (a === '--module' && argv[i + 1]) {
      moduleFilter = argv[++i];
    } else if (a === '--max-diff' && argv[i + 1]) {
      maxDiffLines = Math.max(0, parseInt(argv[++i], 10) || 0);
    }
  }
  return { json, stat, moduleFilter, maxDiffLines, help };
}

function runDiff(a: string, b: string): { code: number; out: string } {
  try {
    const out = execFileSync('diff', ['-u', a, b], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    return { code: 0, out };
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string };
    if (err.status === 1 && typeof err.stdout === 'string') {
      return { code: 1, out: err.stdout };
    }
    throw e;
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { json, stat, moduleFilter, maxDiffLines, help } = parseArgs(argv);
  if (help) {
    console.log(`Usage: npm run diff:core -- [options]

Compare theme Magento_* overrides to vendor/magento core files.

Options:
  --stat              List only theme vs core paths (no unified diff)
  --json              Machine-readable summary + per-file rows
  --module Magento_X  Limit to one theme module directory (e.g. Magento_Catalog)
  --max-diff N        Cap unified diff output (default 400; 0 = unlimited)
  -h, --help          This message

Environment:
  MAGENTO_VENDOR_PATH   Path to vendor/magento (default: ../../vendor/magento from theme root)
`);
    return;
  }
  const vendorRoot = process.env.MAGENTO_VENDOR_PATH?.trim() || DEFAULT_VENDOR;

  if (!fs.existsSync(vendorRoot)) {
    console.error(`Vendor dir not found: ${vendorRoot}`);
    console.error('Set MAGENTO_VENDOR_PATH to your repo’s vendor/magento directory.');
    process.exit(2);
  }

  const pattern = moduleFilter
    ? `${moduleFilter.replace(/\/+$/, '')}/**/*`
    : 'Magento_*/**/*';
  const rawFiles = await glob(pattern, {
    cwd: THEME_ROOT,
    nodir: true,
    ignore: ['**/node_modules/**'],
  });

  type Row = {
    themeRel: string;
    coreRel: string | null;
    status: 'identical' | 'different' | 'missing_core' | 'unmapped';
    diffLines?: number;
    note?: string;
  };

  const rows: Row[] = [];

  for (const themeRel of rawFiles.sort()) {
    const parts = themeRel.split('/');
    const moduleDir = parts[0];
    if (!moduleDir.startsWith('Magento_')) {
      continue;
    }
    const relInModule = parts.slice(1).join('/');
    if (!relInModule) {
      continue;
    }

    const coreRelInModule = themeRelativeToCoreModuleRelative(relInModule);
    if (!coreRelInModule) {
      rows.push({
        themeRel,
        coreRel: null,
        status: 'unmapped',
        note: 'Path type not mapped to core (add mapping in diff-core-vs-theme.ts if needed)',
      });
      continue;
    }

    const pkg = themeModuleDirToPackageName(moduleDir);
    const coreAbs = path.join(vendorRoot, pkg, coreRelInModule);
    const themeAbs = path.join(THEME_ROOT, themeRel);

    if (!fs.existsSync(coreAbs)) {
      rows.push({
        themeRel,
        coreRel: path.join(pkg, coreRelInModule),
        status: 'missing_core',
        note: 'No matching file in vendor (theme-only asset or different core path)',
      });
      continue;
    }

    if (isBinaryPath(themeRel)) {
      const t = fs.readFileSync(themeAbs);
      const c = fs.readFileSync(coreAbs);
      const same = t.length === c.length && Buffer.compare(t, c) === 0;
      rows.push({
        themeRel,
        coreRel: path.join(pkg, coreRelInModule),
        status: same ? 'identical' : 'different',
        note: 'binary',
      });
      continue;
    }

    const t = fs.readFileSync(themeAbs, 'utf8');
    const c = fs.readFileSync(coreAbs, 'utf8');
    if (t === c) {
      rows.push({
        themeRel,
        coreRel: path.join(pkg, coreRelInModule),
        status: 'identical',
      });
      continue;
    }

    let diffLineCount = 0;
    try {
      const { out } = runDiff(coreAbs, themeAbs);
      diffLineCount = out.split('\n').length;
    } catch {
      diffLineCount = -1;
    }

    rows.push({
      themeRel,
      coreRel: path.join(pkg, coreRelInModule),
      status: 'different',
      diffLines: diffLineCount,
    });
  }

  const summary = {
    total: rows.length,
    identical: rows.filter((r) => r.status === 'identical').length,
    different: rows.filter((r) => r.status === 'different').length,
    missing_core: rows.filter((r) => r.status === 'missing_core').length,
    unmapped: rows.filter((r) => r.status === 'unmapped').length,
  };

  if (json) {
    console.log(
      JSON.stringify(
        {
          vendorRoot,
          themeRoot: THEME_ROOT,
          summary,
          files: rows,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`Theme:  ${THEME_ROOT}`);
  console.log(`Vendor: ${vendorRoot}`);
  console.log('');

  const interesting = rows.filter((r) => r.status !== 'identical');
  if (stat) {
    console.log('Summary:', summary);
    console.log('');
    for (const r of interesting) {
      console.log(`[${r.status}] ${r.themeRel}`);
      if (r.coreRel) {
        console.log(`         core: ${r.coreRel}`);
      }
      if (r.note) {
        console.log(`         ${r.note}`);
      }
    }
    return;
  }

  console.log('Summary:', summary);
  console.log('');

  for (const r of rows) {
    if (r.status !== 'different') {
      continue;
    }
    const themeAbs = path.join(THEME_ROOT, r.themeRel);
    const coreAbs = r.coreRel ? path.join(vendorRoot, r.coreRel) : null;
    console.log('---');
    console.log(`THEME ${r.themeRel}`);
    console.log(`CORE  ${r.coreRel}`);
    console.log('');

    if (!coreAbs || !fs.existsSync(coreAbs) || isBinaryPath(r.themeRel)) {
      if (r.note) {
        console.log(`(${r.note})`);
      }
      continue;
    }

    try {
      const { out } = runDiff(coreAbs, themeAbs);
      const lines = out.split('\n');
      const cap = maxDiffLines > 0 ? lines.slice(0, maxDiffLines) : lines;
      console.log(cap.join('\n'));
      if (maxDiffLines > 0 && lines.length > maxDiffLines) {
        console.log(`\n... (${lines.length - maxDiffLines} more lines; use --max-diff 0 for full)`);
      }
    } catch (e) {
      console.error('diff failed:', e);
    }
    console.log('');
  }

  if (interesting.length === 0 || stat) {
    return;
  }

  console.log('---');
  console.log('Non-identical overview (not full diff):');
  for (const r of interesting) {
    if (r.status === 'different') {
      continue;
    }
    console.log(`[${r.status}] ${r.themeRel}`);
    if (r.coreRel) {
      console.log(`         ${r.coreRel}`);
    }
    if (r.note) {
      console.log(`         ${r.note}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
