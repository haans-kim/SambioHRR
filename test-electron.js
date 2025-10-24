console.log('process.versions:', process.versions);
console.log('process.type:', process.type);

// Try different ways to get electron
try {
  const { app } = require('electron');
  console.log('app from destructure:', app);
} catch (e) {
  console.log('Error with destructure:', e.message);
}

try {
  const electron = require('electron');
  console.log('electron:', typeof electron);
  console.log('electron.app:', typeof electron.app);

  if (typeof electron === 'string') {
    console.log('ERROR: electron is a string, not an object!');
  }
} catch (e) {
  console.log('Error:', e.message);
}

setTimeout(() => {
  console.log('Exiting...');
  process.exit(0);
}, 1000);
