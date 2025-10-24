const fs = require('fs');
const path = require('path');

console.log('Post-build: Copying static assets to standalone...');

const standalonePath = path.join(__dirname, '..', '.next', 'standalone');
const staticSource = path.join(__dirname, '..', '.next', 'static');
const staticDest = path.join(standalonePath, '.next', 'static');
const publicSource = path.join(__dirname, '..', 'public');
const publicDest = path.join(standalonePath, 'public');

// 복사 함수
function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`Source not found: ${src}`);
    return;
  }

  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// static 폴더 복사
console.log('Copying .next/static...');
copyRecursiveSync(staticSource, staticDest);
console.log('✓ Static files copied');

// public 폴더 복사
console.log('Copying public...');
copyRecursiveSync(publicSource, publicDest);
console.log('✓ Public files copied');

console.log('Post-build completed!');
