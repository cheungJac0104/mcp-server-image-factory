#!/usr/bin/env node
/**
 * Image Modifier CLI - Compress, resize, rotate, and modify images
 * 
 * Usage:
 *   node scripts/image-modifier.js <command> [options]
 * 
 * Commands:
 *   compress   - Compress image(s)
 *   resize     - Resize image(s)
 *   rotate     - Rotate image(s)
 *   convert    - Convert image format
 *   quality    - Adjust image quality
 *   grayscale  - Convert to grayscale
 *   blur       - Apply blur effect
 *   flip       - Flip or flop image
 *   crop       - Crop image
 *   batch      - Batch process images with multiple operations
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.ico']);

function getFiles(dir, recursive = false) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && recursive) {
      files.push(...getFiles(fullPath, recursive));
    } else if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

function getOutputPath(inputPath, outputDir, suffix = '') {
  const base = path.basename(inputPath, path.extname(inputPath));
  const ext = path.extname(inputPath);
  const outDir = outputDir || path.dirname(inputPath);
  return path.join(outDir, `${base}${suffix}${ext}`);
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

async function processFile(inputPath, outputPath, pipeline) {
  const originalSize = fs.statSync(inputPath).size;
  
  let instance = sharp(inputPath);
  for (const op of pipeline) {
    instance = op(instance);
  }
  
  await instance.toFile(outputPath);
  
  const newSize = fs.statSync(outputPath).size;
  const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);
  
  return {
    input: inputPath,
    output: outputPath,
    originalSize,
    newSize,
    reduction: reduction > 0 ? `-${reduction}%` : `+${Math.abs(reduction)}%`,
  };
}

async function cmdCompress(args) {
  const input = args[0];
  if (!input) {
    console.log('Usage: node scripts/image-modifier.js compress <input> [options]');
    console.log('\nOptions:');
    console.log('  -o, --output <dir>    Output directory (default: same as input)');
    console.log('  -q, --quality <n>     JPEG/WebP quality 1-100 (default: 80)');
    console.log('  -p, --png-level <n>   PNG compression level 0-9 (default: 6)');
    console.log('  -r, --recursive       Process subdirectories');
    console.log('  -s, --suffix <str>    Output filename suffix (default: -compressed)');
    console.log('\nExamples:');
    console.log('  node scripts/image-modifier.js compress photo.jpg');
    console.log('  node scripts/image-modifier.js compress ./images -q 70 -o ./output');
    console.log('  node scripts/image-modifier.js compress ./images -r -q 60');
    return;
  }

  let outputDir = null;
  let quality = 80;
  let pngLevel = 6;
  let recursive = false;
  let suffix = '-compressed';

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '-o': case '--output': outputDir = args[++i]; break;
      case '-q': case '--quality': quality = parseInt(args[++i]); break;
      case '-p': case '--png-level': pngLevel = parseInt(args[++i]); break;
      case '-r': case '--recursive': recursive = true; break;
      case '-s': case '--suffix': suffix = args[++i]; break;
    }
  }

  const files = fs.statSync(input).isDirectory() ? getFiles(input, recursive) : [input];
  
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\nCompressing ${files.length} image(s)...`);
  console.log(`Quality: ${quality}, PNG Level: ${pngLevel}\n`);

  const results = [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const outPath = getOutputPath(file, outputDir, suffix);
    
    const pipeline = [];
    
    if (['.jpg', '.jpeg'].includes(ext)) {
      pipeline.push(img => img.jpeg({ quality, mozjpeg: true }));
    } else if (ext === '.png') {
      pipeline.push(img => img.png({ compressionLevel: pngLevel }));
    } else if (ext === '.webp') {
      pipeline.push(img => img.webp({ quality }));
    } else {
      pipeline.push(img => img.jpeg({ quality }));
    }
    
    const result = await processFile(file, outPath, pipeline);
    results.push(result);
    console.log(`✓ ${path.basename(file)} -> ${path.basename(outPath)} (${formatBytes(result.originalSize)} -> ${formatBytes(result.newSize)}, ${result.reduction})`);
  }

  const totalOriginal = results.reduce((s, r) => s + r.originalSize, 0);
  const totalNew = results.reduce((s, r) => s + r.newSize, 0);
  const totalReduction = ((totalOriginal - totalNew) / totalOriginal * 100).toFixed(1);
  
  console.log(`\nTotal: ${formatBytes(totalOriginal)} -> ${formatBytes(totalNew)} (${totalReduction}% reduction)`);
}

async function cmdResize(args) {
  const input = args[0];
  if (!input) {
    console.log('Usage: node scripts/image-modifier.js resize <input> [options]');
    console.log('\nOptions:');
    console.log('  -w, --width <n>       Target width');
    console.log('  -h, --height <n>      Target height');
    console.log('  -p, --percent <n>     Scale percentage (50 = half size)');
    console.log('  -f, --fit <mode>      Fit mode: cover, contain, fill, inside, outside (default: cover)');
    console.log('  -o, --output <dir>    Output directory');
    console.log('  -r, --recursive       Process subdirectories');
    console.log('  -s, --suffix <str>    Output filename suffix (default: -resized)');
    console.log('\nExamples:');
    console.log('  node scripts/image-modifier.js resize photo.jpg -w 800 -h 600');
    console.log('  node scripts/image-modifier.js resize photo.jpg -p 50');
    console.log('  node scripts/image-modifier.js resize ./images -w 1920 -h 1080 -r');
    return;
  }

  let width = null;
  let height = null;
  let percent = null;
  let fit = 'cover';
  let outputDir = null;
  let recursive = false;
  let suffix = '-resized';

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '-w': case '--width': width = parseInt(args[++i]); break;
      case '-h': case '--height': height = parseInt(args[++i]); break;
      case '-p': case '--percent': percent = parseInt(args[++i]); break;
      case '-f': case '--fit': fit = args[++i]; break;
      case '-o': case '--output': outputDir = args[++i]; break;
      case '-r': case '--recursive': recursive = true; break;
      case '-s': case '--suffix': suffix = args[++i]; break;
    }
  }

  if (!width && !height && !percent) {
    console.error('Error: Specify -w, -h, or -p');
    return;
  }

  const files = fs.statSync(input).isDirectory() ? getFiles(input, recursive) : [input];
  
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\nResizing ${files.length} image(s)...`);
  if (percent) {
    console.log(`Scale: ${percent}%`);
  } else {
    console.log(`Target: ${width || 'auto'}x${height || 'auto'}, Fit: ${fit}`);
  }
  console.log();

  const results = [];
  for (const file of files) {
    const outPath = getOutputPath(file, outputDir, suffix);
    const meta = await sharp(file).metadata();
    
    const pipeline = [];
    
    if (percent) {
      const newWidth = Math.round(meta.width * percent / 100);
      const newHeight = Math.round(meta.height * percent / 100);
      pipeline.push(img => img.resize(newWidth, newHeight));
    } else {
      pipeline.push(img => img.resize(width, height, { fit }));
    }
    
    const result = await processFile(file, outPath, pipeline);
    results.push(result);
    console.log(`✓ ${path.basename(file)} (${meta.width}x${meta.height}) -> ${path.basename(outPath)}`);
  }

  console.log(`\nDone: ${results.length} image(s) resized`);
}

async function cmdRotate(args) {
  const input = args[0];
  if (!input) {
    console.log('Usage: node scripts/image-modifier.js rotate <input> [options]');
    console.log('\nOptions:');
    console.log('  -d, --degrees <n>     Rotation degrees: 90, 180, 270 (default: 90)');
    console.log('  -o, --output <dir>    Output directory');
    console.log('  -r, --recursive       Process subdirectories');
    console.log('  -s, --suffix <str>    Output filename suffix (default: -rotated)');
    console.log('\nExamples:');
    console.log('  node scripts/image-modifier.js rotate photo.jpg -d 90');
    console.log('  node scripts/image-modifier.js rotate photo.jpg -d 180');
    return;
  }

  let degrees = 90;
  let outputDir = null;
  let recursive = false;
  let suffix = '-rotated';

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '-d': case '--degrees': degrees = parseInt(args[++i]); break;
      case '-o': case '--output': outputDir = args[++i]; break;
      case '-r': case '--recursive': recursive = true; break;
      case '-s': case '--suffix': suffix = args[++i]; break;
    }
  }

  const files = fs.statSync(input).isDirectory() ? getFiles(input, recursive) : [input];
  
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\nRotating ${files.length} image(s) by ${degrees} degrees...\n`);

  const results = [];
  for (const file of files) {
    const outPath = getOutputPath(file, outputDir, suffix);
    const pipeline = [img => img.rotate(degrees)];
    const result = await processFile(file, outPath, pipeline);
    results.push(result);
    console.log(`✓ ${path.basename(file)} -> ${path.basename(outPath)}`);
  }

  console.log(`\nDone: ${results.length} image(s) rotated`);
}

async function cmdConvert(args) {
  const input = args[0];
  if (!input) {
    console.log('Usage: node scripts/image-modifier.js convert <input> [options]');
    console.log('\nOptions:');
    console.log('  -f, --format <fmt>    Target format: jpg, png, webp, tiff, avif');
    console.log('  -q, --quality <n>     Output quality 1-100 (default: 80)');
    console.log('  -o, --output <dir>    Output directory');
    console.log('  -r, --recursive       Process subdirectories');
    console.log('\nExamples:');
    console.log('  node scripts/image-modifier.js convert photo.png -f jpg');
    console.log('  node scripts/image-modifier.js convert ./images -f webp -q 85');
    return;
  }

  let format = 'jpg';
  let quality = 80;
  let outputDir = null;
  let recursive = false;

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '-f': case '--format': format = args[++i]; break;
      case '-q': case '--quality': quality = parseInt(args[++i]); break;
      case '-o': case '--output': outputDir = args[++i]; break;
      case '-r': case '--recursive': recursive = true; break;
    }
  }

  const files = fs.statSync(input).isDirectory() ? getFiles(input, recursive) : [input];
  
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const extMap = { jpg: '.jpg', jpeg: '.jpg', png: '.png', webp: '.webp', tiff: '.tiff', avif: '.avif' };
  const newExt = extMap[format] || '.jpg';

  console.log(`\nConverting ${files.length} image(s) to ${format}...\n`);

  const results = [];
  for (const file of files) {
    const base = path.basename(file, path.extname(file));
    const outPath = path.join(outputDir || path.dirname(file), `${base}${newExt}`);
    
    const pipeline = [];
    switch (format) {
      case 'jpg': case 'jpeg':
        pipeline.push(img => img.jpeg({ quality }));
        break;
      case 'png':
        pipeline.push(img => img.png());
        break;
      case 'webp':
        pipeline.push(img => img.webp({ quality }));
        break;
      case 'tiff':
        pipeline.push(img => img.tiff());
        break;
      case 'avif':
        pipeline.push(img => img.avif({ quality }));
        break;
    }
    
    const result = await processFile(file, outPath, pipeline);
    results.push(result);
    console.log(`✓ ${path.basename(file)} -> ${path.basename(outPath)} (${formatBytes(result.originalSize)} -> ${formatBytes(result.newSize)})`);
  }

  console.log(`\nDone: ${results.length} image(s) converted`);
}

async function cmdQuality(args) {
  const input = args[0];
  if (!input) {
    console.log('Usage: node scripts/image-modifier.js quality <input> [options]');
    console.log('\nOptions:');
    console.log('  -q, --quality <n>     Quality 1-100 (default: 80)');
    console.log('  -o, --output <dir>    Output directory');
    console.log('  -r, --recursive       Process subdirectories');
    console.log('  -s, --suffix <str>    Output filename suffix (default: -quality)');
    return;
  }

  let quality = 80;
  let outputDir = null;
  let recursive = false;
  let suffix = '-quality';

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '-q': case '--quality': quality = parseInt(args[++i]); break;
      case '-o': case '--output': outputDir = args[++i]; break;
      case '-r': case '--recursive': recursive = true; break;
      case '-s': case '--suffix': suffix = args[++i]; break;
    }
  }

  const files = fs.statSync(input).isDirectory() ? getFiles(input, recursive) : [input];
  
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\nAdjusting quality to ${quality} for ${files.length} image(s)...\n`);

  const results = [];
  for (const file of files) {
    const outPath = getOutputPath(file, outputDir, suffix);
    const pipeline = [img => img.jpeg({ quality }).png({ quality: Math.round(quality / 100 * 9) }).webp({ quality })];
    const result = await processFile(file, outPath, pipeline);
    results.push(result);
    console.log(`✓ ${path.basename(file)} -> ${path.basename(outPath)} (${formatBytes(result.originalSize)} -> ${formatBytes(result.newSize)})`);
  }

  console.log(`\nDone: ${results.length} image(s) processed`);
}

async function cmdGrayscale(args) {
  const input = args[0];
  if (!input) {
    console.log('Usage: node scripts/image-modifier.js grayscale <input> [options]');
    console.log('\nOptions:');
    console.log('  -o, --output <dir>    Output directory');
    console.log('  -r, --recursive       Process subdirectories');
    console.log('  -s, --suffix <str>    Output filename suffix (default: -bw)');
    return;
  }

  let outputDir = null;
  let recursive = false;
  let suffix = '-bw';

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '-o': case '--output': outputDir = args[++i]; break;
      case '-r': case '--recursive': recursive = true; break;
      case '-s': case '--suffix': suffix = args[++i]; break;
    }
  }

  const files = fs.statSync(input).isDirectory() ? getFiles(input, recursive) : [input];
  
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\nConverting ${files.length} image(s) to grayscale...\n`);

  const results = [];
  for (const file of files) {
    const outPath = getOutputPath(file, outputDir, suffix);
    const pipeline = [img => img.grayscale()];
    const result = await processFile(file, outPath, pipeline);
    results.push(result);
    console.log(`✓ ${path.basename(file)} -> ${path.basename(outPath)}`);
  }

  console.log(`\nDone: ${results.length} image(s) converted to grayscale`);
}

async function cmdBlur(args) {
  const input = args[0];
  if (!input) {
    console.log('Usage: node scripts/image-modifier.js blur <input> [options]');
    console.log('\nOptions:');
    console.log('  -b, --sigma <n>       Blur sigma 0.3-1000 (default: 5)');
    console.log('  -o, --output <dir>    Output directory');
    console.log('  -r, --recursive       Process subdirectories');
    console.log('  -s, --suffix <str>    Output filename suffix (default: -blur)');
    return;
  }

  let sigma = 5;
  let outputDir = null;
  let recursive = false;
  let suffix = '-blur';

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '-b': case '--sigma': sigma = parseFloat(args[++i]); break;
      case '-o': case '--output': outputDir = args[++i]; break;
      case '-r': case '--recursive': recursive = true; break;
      case '-s': case '--suffix': suffix = args[++i]; break;
    }
  }

  const files = fs.statSync(input).isDirectory() ? getFiles(input, recursive) : [input];
  
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\nApplying blur (sigma: ${sigma}) to ${files.length} image(s)...\n`);

  const results = [];
  for (const file of files) {
    const outPath = getOutputPath(file, outputDir, suffix);
    const pipeline = [img => img.blur(sigma)];
    const result = await processFile(file, outPath, pipeline);
    results.push(result);
    console.log(`✓ ${path.basename(file)} -> ${path.basename(outPath)}`);
  }

  console.log(`\nDone: ${results.length} image(s) blurred`);
}

async function cmdFlip(args) {
  const input = args[0];
  if (!input) {
    console.log('Usage: node scripts/image-modifier.js flip <input> [options]');
    console.log('\nOptions:');
    console.log('  -d, --direction <d>   Direction: horizontal, vertical (default: horizontal)');
    console.log('  -o, --output <dir>    Output directory');
    console.log('  -r, --recursive       Process subdirectories');
    console.log('  -s, --suffix <str>    Output filename suffix (default: -flipped)');
    return;
  }

  let direction = 'horizontal';
  let outputDir = null;
  let recursive = false;
  let suffix = '-flipped';

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '-d': case '--direction': direction = args[++i]; break;
      case '-o': case '--output': outputDir = args[++i]; break;
      case '-r': case '--recursive': recursive = true; break;
      case '-s': case '--suffix': suffix = args[++i]; break;
    }
  }

  const files = fs.statSync(input).isDirectory() ? getFiles(input, recursive) : [input];
  
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\nFlipping ${files.length} image(s) ${direction}...\n`);

  const results = [];
  for (const file of files) {
    const outPath = getOutputPath(file, outputDir, suffix);
    const pipeline = [
      direction === 'horizontal' ? img => img.flop() : img => img.flip()
    ];
    const result = await processFile(file, outPath, pipeline);
    results.push(result);
    console.log(`✓ ${path.basename(file)} -> ${path.basename(outPath)}`);
  }

  console.log(`\nDone: ${results.length} image(s) flipped`);
}

async function cmdCrop(args) {
  const input = args[0];
  if (!input) {
    console.log('Usage: node scripts/image-modifier.js crop <input> [options]');
    console.log('\nOptions:');
    console.log('  -x, --left <n>        Left offset (pixels)');
    console.log('  -y, --top <n>         Top offset (pixels)');
    console.log('  -w, --width <n>       Crop width (pixels)');
    console.log('  -h, --height <n>      Crop height (pixels)');
    console.log('  -o, --output <dir>    Output directory');
    console.log('  -r, --recursive       Process subdirectories');
    console.log('  -s, --suffix <str>    Output filename suffix (default: -cropped)');
    console.log('\nExamples:');
    console.log('  node scripts/image-modifier.js crop photo.jpg -x 100 -y 50 -w 400 -h 300');
    return;
  }

  let left = 0;
  let top = 0;
  let width = null;
  let height = null;
  let outputDir = null;
  let recursive = false;
  let suffix = '-cropped';

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '-x': case '--left': left = parseInt(args[++i]); break;
      case '-y': case '--top': top = parseInt(args[++i]); break;
      case '-w': case '--width': width = parseInt(args[++i]); break;
      case '-h': case '--height': height = parseInt(args[++i]); break;
      case '-o': case '--output': outputDir = args[++i]; break;
      case '-r': case '--recursive': recursive = true; break;
      case '-s': case '--suffix': suffix = args[++i]; break;
    }
  }

  if (!width || !height) {
    console.error('Error: -w (width) and -h (height) are required');
    return;
  }

  const files = fs.statSync(input).isDirectory() ? getFiles(input, recursive) : [input];
  
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\nCropping ${files.length} image(s) to ${width}x${height} at (${left},${top})...\n`);

  const results = [];
  for (const file of files) {
    const outPath = getOutputPath(file, outputDir, suffix);
    const pipeline = [img => img.extract({ left, top, width, height })];
    const result = await processFile(file, outPath, pipeline);
    results.push(result);
    console.log(`✓ ${path.basename(file)} -> ${path.basename(outPath)}`);
  }

  console.log(`\nDone: ${results.length} image(s) cropped`);
}

async function cmdBatch(args) {
  const input = args[0];
  if (!input) {
    console.log('Usage: node scripts/image-modifier.js batch <input> [operations]');
    console.log('\nOperations (can combine multiple):');
    console.log('  --resize <WxH>        Resize (e.g., --resize 1920x1080)');
    console.log('  --compress [quality]  Compress (default quality: 80)');
    console.log('  --rotate <degrees>    Rotate (90, 180, 270)');
    console.log('  --grayscale           Convert to grayscale');
    console.log('  --blur [sigma]        Apply blur (default sigma: 5)');
    console.log('  --flip [direction]    Flip (horizontal/vertical)');
    console.log('\nOptions:');
    console.log('  -o, --output <dir>    Output directory (required for batch)');
    console.log('  -r, --recursive       Process subdirectories');
    console.log('  -s, --suffix <str>    Output filename suffix (default: -modified)');
    console.log('\nExamples:');
    console.log('  node scripts/image-modifier.js batch ./photos --resize 800x600 --compress 75 -o ./output');
    console.log('  node scripts/image-modifier.js batch ./photos --rotate 90 --grayscale -o ./output');
    return;
  }

  let outputDir = null;
  let recursive = false;
  let suffix = '-modified';
  const operations = [];

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '-o': case '--output': outputDir = args[++i]; break;
      case '-r': case '--recursive': recursive = true; break;
      case '-s': case '--suffix': suffix = args[++i]; break;
      case '--resize': {
        const [w, h] = args[++i].split('x').map(Number);
        operations.push({ type: 'resize', width: w, height: h });
        break;
      }
      case '--compress': {
        const quality = args[i + 1] && !args[i + 1].startsWith('--') ? parseInt(args[++i]) : 80;
        operations.push({ type: 'compress', quality });
        break;
      }
      case '--rotate': {
        const degrees = parseInt(args[++i]);
        operations.push({ type: 'rotate', degrees });
        break;
      }
      case '--grayscale':
        operations.push({ type: 'grayscale' });
        break;
      case '--blur': {
        const sigma = args[i + 1] && !args[i + 1].startsWith('--') ? parseFloat(args[++i]) : 5;
        operations.push({ type: 'blur', sigma });
        break;
      }
      case '--flip': {
        const dir = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'horizontal';
        operations.push({ type: 'flip', direction: dir });
        break;
      }
    }
  }

  if (operations.length === 0) {
    console.error('Error: At least one operation is required');
    return;
  }

  if (!outputDir) {
    console.error('Error: -o/--output is required for batch processing');
    return;
  }

  const files = fs.statSync(input).isDirectory() ? getFiles(input, recursive) : [input];
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\nBatch processing ${files.length} image(s) with ${operations.length} operation(s):`);
  operations.forEach(op => {
    switch (op.type) {
      case 'resize': console.log(`  - Resize to ${op.width}x${op.height}`); break;
      case 'compress': console.log(`  - Compress (quality: ${op.quality})`); break;
      case 'rotate': console.log(`  - Rotate ${op.degrees}°`); break;
      case 'grayscale': console.log(`  - Grayscale`); break;
      case 'blur': console.log(`  - Blur (sigma: ${op.sigma})`); break;
      case 'flip': console.log(`  - Flip ${op.direction}`); break;
    }
  });
  console.log();

  const results = [];
  for (const file of files) {
    const outPath = getOutputPath(file, outputDir, suffix);
    
    const pipeline = operations.map(op => {
      switch (op.type) {
        case 'resize':
          return img => img.resize(op.width, op.height, { fit: 'cover' });
        case 'compress':
          return img => img.jpeg({ quality: op.quality, mozjpeg: true }).png({ compressionLevel: 6 }).webp({ quality: op.quality });
        case 'rotate':
          return img => img.rotate(op.degrees);
        case 'grayscale':
          return img => img.grayscale();
        case 'blur':
          return img => img.blur(op.sigma);
        case 'flip':
          return op.direction === 'horizontal' ? img => img.flop() : img => img.flip();
        default:
          return img => img;
      }
    });
    
    const result = await processFile(file, outPath, pipeline);
    results.push(result);
    console.log(`✓ ${path.basename(file)} -> ${path.basename(outPath)} (${formatBytes(result.originalSize)} -> ${formatBytes(result.newSize)})`);
  }

  const totalOriginal = results.reduce((s, r) => s + r.originalSize, 0);
  const totalNew = results.reduce((s, r) => s + r.newSize, 0);
  const totalReduction = ((totalOriginal - totalNew) / totalOriginal * 100).toFixed(1);
  
  console.log(`\nDone: ${results.length} image(s) processed`);
  console.log(`Total: ${formatBytes(totalOriginal)} -> ${formatBytes(totalNew)} (${totalReduction}% reduction)`);
}

// Parse CLI arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'compress':
    await cmdCompress(args.slice(1));
    break;
  case 'resize':
    await cmdResize(args.slice(1));
    break;
  case 'rotate':
    await cmdRotate(args.slice(1));
    break;
  case 'convert':
    await cmdConvert(args.slice(1));
    break;
  case 'quality':
    await cmdQuality(args.slice(1));
    break;
  case 'grayscale':
    await cmdGrayscale(args.slice(1));
    break;
  case 'blur':
    await cmdBlur(args.slice(1));
    break;
  case 'flip':
    await cmdFlip(args.slice(1));
    break;
  case 'crop':
    await cmdCrop(args.slice(1));
    break;
  case 'batch':
    await cmdBatch(args.slice(1));
    break;
  default:
    console.log(`
Image Modifier CLI - Compress, resize, rotate, and modify images

Usage:
  node scripts/image-modifier.js <command> [options]

Commands:
  compress   - Compress image(s) with quality control
  resize     - Resize image(s) by dimensions or percentage
  rotate     - Rotate image(s) by 90, 180, or 270 degrees
  convert    - Convert image format (jpg, png, webp, tiff, avif)
  quality    - Adjust image quality
  grayscale  - Convert to black & white
  blur       - Apply blur effect
  flip       - Flip or flop image
  crop       - Crop image to specific region
  batch      - Batch process with multiple operations

Examples:
  node scripts/image-modifier.js compress photo.jpg -q 70
  node scripts/image-modifier.js resize photo.jpg -w 800 -h 600
  node scripts/image-modifier.js resize photo.jpg -p 50
  node scripts/image-modifier.js rotate photo.jpg -d 90
  node scripts/image-modifier.js convert photo.png -f webp
  node scripts/image-modifier.js batch ./photos --resize 1920x1080 --compress 80 -o ./output
`);
}
