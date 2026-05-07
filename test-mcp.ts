import { ImageProcessor } from './src/image-processor.js';
import { ModelSelector } from './src/model-selector.js';
import { ReportGenerator } from './src/report-generator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGE_DIR = 'C:\\Users\\HKC10\\Desktop\\image_materials';
const OUTPUT_DIR = path.resolve(IMAGE_DIR, 'output');

async function test() {
  console.log('=== Image Report MCP Server Test ===\n');
  
  // Load config
  const configPath = path.join(__dirname, 'config.json');
  const serverConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  const modelConfig = {
    provider: serverConfig.activeProvider,
    model: serverConfig.activeModel,
    maxTokens: serverConfig.maxTokens,
    temperature: serverConfig.temperature,
  };
  
  console.log(`Provider: ${modelConfig.provider}`);
  console.log(`Model: ${modelConfig.model}\n`);
  
  // Initialize model selector
  const modelSelector = new ModelSelector(modelConfig);
  
  // Discover images
  console.log('Discovering images...');
  const images = await ImageProcessor.discoverImages(IMAGE_DIR);
  console.log(`Found ${images.length} images:\n`);
  images.forEach((img, i) => console.log(`${i + 1}. ${path.basename(img)}`));
  console.log('');
  
  // Analyze each image
  const results = [];
  
  for (const imagePath of images) {
    console.log(`\nAnalyzing: ${path.basename(imagePath)}...`);
    
    try {
      // Extract metadata
      const metadata = await ImageProcessor.extractMetadata(imagePath);
      console.log(`  Size: ${metadata.width}x${metadata.height}, Format: ${metadata.format}`);
      
      // AI Analysis
      const prompt = `Describe this image in detail. Include:
1. Main subjects and objects
2. Colors and composition  
3. Setting or context
4. Notable features

Then suggest a descriptive filename in kebab-case format (under 60 chars, no extension).
Format your response as:
DESCRIPTION: [your detailed description]
CAPTION: [brief 1-2 sentence caption]
FILENAME: [suggested filename]`;

      const analysis = await modelSelector.analyzeImage(imagePath, prompt);
      
      const descriptionMatch = analysis.match(/DESCRIPTION:\s*(.+?)(?=CAPTION:|$)/s);
      const captionMatch = analysis.match(/CAPTION:\s*(.+?)(?=FILENAME:|$)/s);
      const filenameMatch = analysis.match(/FILENAME:\s*(.+)/);
      
      const description = descriptionMatch?.[1]?.trim() || analysis;
      const caption = captionMatch?.[1]?.trim() || '';
      const suggestedName = filenameMatch?.[1]?.trim() || path.basename(imagePath);
      
      const ext = path.extname(imagePath);
      const fullSuggestedName = suggestedName.replace(/\.[^/.]+$/, '') + ext;
      
      results.push({
        original: path.basename(imagePath),
        suggested: fullSuggestedName,
        metadata,
        description,
        caption,
      });
      
      console.log(`  Suggested name: ${fullSuggestedName}`);
      console.log(`  Caption: ${caption.substring(0, 80)}...`);
      
    } catch (error) {
      console.error(`  Error: ${(error as Error).message}`);
    }
  }
  
  // Generate reports
  console.log('\n=== Generating Reports ===\n');
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}\n`);
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  // Normal report
  const normalReport = ReportGenerator.generateNormalReport(results);
  const normalPath = path.join(OUTPUT_DIR, `image-report-${timestamp}.md`);
  fs.writeFileSync(normalPath, normalReport);
  console.log(`Normal report saved: ${normalPath}`);
  
  // Caveman report
  const cavemanReport = ReportGenerator.generateCavemanReport(results);
  const cavemanPath = path.join(OUTPUT_DIR, `image-report-caveman-${timestamp}.md`);
  fs.writeFileSync(cavemanPath, cavemanReport);
  console.log(`Caveman report saved: ${cavemanPath}`);
  
  // JSON report
  const jsonReport = ReportGenerator.generateJSONReport(results);
  const jsonPath = path.join(OUTPUT_DIR, `image-report-${timestamp}.json`);
  fs.writeFileSync(jsonPath, jsonReport);
  console.log(`JSON report saved: ${jsonPath}`);
  
  // CSV report
  const csvReport = ReportGenerator.generateCSVReport(results);
  const csvPath = path.join(OUTPUT_DIR, `image-report-${timestamp}.csv`);
  fs.writeFileSync(csvPath, csvReport);
  console.log(`CSV report saved: ${csvPath}`);
  
  // Rename images if enabled
  console.log('\n=== Renaming Images ===\n');
  
  const renames = results.map(r => ({
    from: path.join(IMAGE_DIR, r.original),
    to: r.suggested,
  }));
  
  for (const { from, to } of renames) {
    const toPath = path.join(IMAGE_DIR, to);
    if (fs.existsSync(toPath)) {
      console.log(`SKIP: ${to} already exists`);
      continue;
    }
    if (from !== toPath) {
      fs.renameSync(from, toPath);
      console.log(`RENAMED: ${path.basename(from)} -> ${to}`);
    }
  }
  
  console.log('\n=== Test Complete ===');
}

test().catch(console.error);
