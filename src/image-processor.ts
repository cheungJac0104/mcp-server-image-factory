import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { ImageMetadata } from './types.js';

export class ImageProcessor {
  static async extractMetadata(imagePath: string): Promise<ImageMetadata> {
    const stats = fs.statSync(imagePath);
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    const { width = 0, height = 0 } = metadata;
    const aspectRatio = this.calculateAspectRatio(width, height);

    return {
      width,
      height,
      aspectRatio,
      format: metadata.format || 'unknown',
      fileSize: stats.size,
      colorMode: metadata.space || undefined,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
    };
  }

  static calculateAspectRatio(width: number, height: number): string {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  }

  static generateFileName(description: string, style: 'kebab-case' | 'snake_case' | 'camelCase' | 'keep-original', originalName: string): string {
    if (style === 'keep-original') return originalName;

    const ext = path.extname(originalName);
    const words = description.toLowerCase().match(/\b\w+\b/g) || [];
    const keyWords = words.slice(0, 6);

    let name: string;
    switch (style) {
      case 'kebab-case':
        name = keyWords.join('-');
        break;
      case 'snake_case':
        name = keyWords.join('_');
        break;
      case 'camelCase':
        name = keyWords
          .map((word, i) => (i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
          .join('');
        break;
      default:
        name = keyWords.join('-');
    }

    return `${name}${ext}`;
  }

  static async discoverImages(directory: string, patterns: string[] = ['*.{jpg,jpeg,png,gif,bmp,webp,svg,tiff,ico,heic,raw}']): Promise<string[]> {
    const extensions = new Set([
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.ico', '.heic', '.raw',
    ]);

    const files = fs.readdirSync(directory);
    return files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return extensions.has(ext) && !file.startsWith('.');
      })
      .map(file => path.join(directory, file));
  }
}
