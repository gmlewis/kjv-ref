import { chromium } from 'playwright';
import { spawn } from 'child_process';

async function main() {
  console.log('🚀 Starting Vite preview server at http://localhost:4173/kjv-ref/ ...');
  const preview = spawn('bun', ['run', 'preview', '--', '--port', '4173'], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });

  // Give preview server a moment to start
  await new Promise((r) => setTimeout(r, 2000));

  console.log('📱 Launching Chrome in Pixel 10XL simulation mode (412x915, DPR 2.625, touch enabled)...');
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--enable-unsafe-webgpu',
      '--enable-features=Vulkan,UseSkiaRenderer,WebGPU',
      '--ignore-gpu-blocklist',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 10 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  });

  const page = await context.newPage();

  // Force dark mode in localStorage and on <html> before app loads
  await page.addInitScript(() => {
    localStorage.setItem('kjv-theme', 'dark');
    document.documentElement.classList.add('dark');
  });

  console.log('Opening http://localhost:4173/kjv-ref/practice/game in dark mode...');
  await page.goto('http://localhost:4173/kjv-ref/practice/game', { waitUntil: 'domcontentloaded' });

  console.log('\n===========================================================');
  console.log('  ✅ Pixel 10XL Mobile Simulator is running!');
  console.log('  - Viewport: 412 x 915 px (DPR 2.625)');
  console.log('  - URL: http://localhost:4173/kjv-ref/practice/game');
  console.log('  - Close the Chrome browser window or press Ctrl+C to exit.');
  console.log('===========================================================\n');

  browser.on('disconnected', () => {
    preview.kill();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await browser.close();
    preview.kill();
    process.exit(0);
  });
}

main().catch(console.error);
