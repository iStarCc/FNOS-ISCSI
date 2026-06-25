const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'fnnas.iscsi');
const APP_DIR = path.join(DIST, 'app');

function run(cmd, cwd = ROOT) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function cleanAppDir() {
  const keep = new Set(['ui']);
  for (const entry of fs.readdirSync(APP_DIR, { withFileTypes: true })) {
    if (keep.has(entry.name)) continue;
    const p = path.join(APP_DIR, entry.name);
    fs.rmSync(p, { recursive: true, force: true });
  }
}

console.log('=== Building fnnas.iscsi ===\n');

// 1. 构建前端
console.log('[1/4] Building frontend...');
run('npm run build', path.join(ROOT, 'frontend'));

// 2. 清理 app 目录（保留 ui/）
console.log('\n[2/4] Preparing app directory...');
cleanAppDir();

// 3. 复制后端文件到 app/ （安装后即 $TRIM_APPDEST）
console.log('\n[3/4] Copying backend files...');
const backendSrc = path.join(ROOT, 'backend');
for (const f of ['server.js', 'package.json']) {
  fs.copyFileSync(path.join(backendSrc, f), path.join(APP_DIR, f));
}
copyDir(path.join(backendSrc, 'routes'), path.join(APP_DIR, 'routes'));
copyDir(path.join(backendSrc, 'services'), path.join(APP_DIR, 'services'));

// 安装生产依赖
console.log('Installing production dependencies...');
run('npm install --omit=dev', APP_DIR);

// 复制前端构建产物
copyDir(path.join(ROOT, 'frontend', 'dist'), path.join(APP_DIR, 'public'));

// 4. 打包 fpk
console.log('\n[4/4] Packaging fpk...');
const fnpackPaths = ['fnpack', '/tmp/fnpack', '/usr/local/bin/fnpack'];
let fnpackBin = null;
for (const p of fnpackPaths) {
  try {
    execSync(`${p} build --help`, { stdio: 'ignore' });
    fnpackBin = p;
    break;
  } catch {}
}

if (fnpackBin) {
  run(`${fnpackBin} build`, DIST);
  console.log(`\n=== Build complete! fpk: ${path.join(DIST, 'fnnas.iscsi.fpk')} ===`);
} else {
  console.log('\nfnpack not found. Install: https://static2.fnnas.com/fnpack/');
  console.log('\n=== Build complete (without fpk) ===');
}
