import { ImageAnalysis } from './types.js';

export class ReportGenerator {
  static generateNormalReport(images: ImageAnalysis[]): string {
    let report = '# Image Report\n\n';

    images.forEach((img, index) => {
      report += `## ${index + 1}: ${this.extractTitle(img.suggested)}\n`;
      report += `**Original:** ${img.original}\n`;
      report += `**Rename:** ${img.suggested}\n\n`;

      report += '### Metadata\n';
      report += `- Dimensions: ${img.metadata.width}x${img.metadata.height}\n`;
      report += `- Aspect Ratio: ${img.metadata.aspectRatio}\n`;
      report += `- Format: ${img.metadata.format.toUpperCase()}\n`;
      report += `- File Size: ${(img.metadata.fileSize / 1024).toFixed(2)} KB\n`;
      report += `- Created: ${img.metadata.created}\n`;
      report += `- Modified: ${img.metadata.modified}\n\n`;

      report += '### Description\n';
      report += `${img.description}\n\n`;

      report += '### Caption\n';
      report += `${img.caption}\n\n`;
      report += '---\n\n';
    });

    report += '## Summary Table\n';
    report += '| # | Original | New Name | Dimensions | Size |\n';
    report += '|---|----------|----------|------------|------|\n';

    images.forEach((img, index) => {
      report += `| ${index + 1} | ${img.original} | ${img.suggested} | ${img.metadata.width}x${img.metadata.height} | ${(img.metadata.fileSize / 1024).toFixed(2)} KB |\n`;
    });

    return report;
  }

  static generateCavemanReport(images: ImageAnalysis[]): string {
    let report = '# Image Report - Caveman\n\n';

    images.forEach((img, index) => {
      report += `## IMG${index + 1}: ${img.suggested}\n`;
      report += `**Was:** ${img.original}\n\n`;

      report += '### Meta\n';
      report += `- Size: ${img.metadata.width}x${img.metadata.height} | ${img.metadata.aspectRatio} | ${img.metadata.format.toUpperCase()} | ${(img.metadata.fileSize / 1024).toFixed(2)} KB | ${img.metadata.modified}\n\n`;

      report += '### Desc\n';
      report += `${this.compressText(img.description)}\n\n`;

      report += '### Caption\n';
      report += `${img.caption}\n\n`;
      report += '---\n\n';
    });

    report += '## Summary\n';
    report += '| # | Was | Now | Size | KB |\n';
    report += '|---|-----|-----|------|-----|\n';

    images.forEach((img, index) => {
      report += `| ${index + 1} | ${img.original} | ${img.suggested} | ${img.metadata.width}x${img.metadata.height} | ${(img.metadata.fileSize / 1024).toFixed(2)} |\n`;
    });

    return report;
  }

  static generateJSONReport(images: ImageAnalysis[]): string {
    return JSON.stringify({ images }, null, 2);
  }

  static generateCSVReport(images: ImageAnalysis[]): string {
    let csv = 'original,suggested,width,height,format,size_kb,description,caption\n';

    images.forEach(img => {
      const escapeCSV = (text: string) => `"${text.replace(/"/g, '""')}"`;
      csv += `${escapeCSV(img.original)},${escapeCSV(img.suggested)},${img.metadata.width},${img.metadata.height},${img.metadata.format},${(img.metadata.fileSize / 1024).toFixed(2)},${escapeCSV(img.description)},${escapeCSV(img.caption)}\n`;
    });

    return csv;
  }

  private static extractTitle(fileName: string): string {
    return fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private static compressText(text: string): string {
    return text.split('.').slice(0, 2).join('.') + '.';
  }
}
