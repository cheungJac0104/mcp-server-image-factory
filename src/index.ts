#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ModelSelector } from './model-selector.js';
import { ImageProcessor } from './image-processor.js';
import { ReportGenerator } from './report-generator.js';
import { SkillConfig, ModelConfig, ImageAnalysis, OutputConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = new McpServer({
  name: 'image-report-mcp-server',
  version: '1.0.0',
});

let modelSelector: ModelSelector;
let skillConfig: SkillConfig;
let outputConfig: OutputConfig;

function loadOutputConfig(serverConfig: any): OutputConfig {
  return {
    directory: serverConfig.output?.directory || './output',
    saveToFile: serverConfig.output?.saveToFile ?? true,
    formats: serverConfig.output?.formats || ['normal', 'caveman', 'json'],
    namingStyle: serverConfig.output?.namingStyle || 'kebab-case',
    includeMetadata: serverConfig.output?.includeMetadata || 'full',
    captionLength: serverConfig.output?.captionLength || 'medium',
  };
}

function initializeConfig() {
  const opencodeConfigPath = path.join(process.cwd(), 'opencode.json');
  const legacyConfigPath = path.join(process.cwd(), 'image-report-config.json');
  
  let loadedConfig: Partial<SkillConfig> = {};
  const serverConfigPath = path.join(__dirname, '..', 'config.json');
  const serverConfig = fs.existsSync(serverConfigPath) ? JSON.parse(fs.readFileSync(serverConfigPath, 'utf-8')) : {};

  outputConfig = loadOutputConfig(serverConfig);

  if (fs.existsSync(opencodeConfigPath)) {
    const opencodeConfig = JSON.parse(fs.readFileSync(opencodeConfigPath, 'utf-8'));
    if (opencodeConfig.imageReport) {
      loadedConfig = opencodeConfig.imageReport;
    }
  } else if (fs.existsSync(legacyConfigPath)) {
    skillConfig = JSON.parse(fs.readFileSync(legacyConfigPath, 'utf-8'));
  } else {
    skillConfig = {
      model: {
        provider: serverConfig.activeProvider || 'nvidia',
        model: serverConfig.activeModel || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
        maxTokens: serverConfig.maxTokens || 2048,
        temperature: serverConfig.temperature || 0.7,
      },
      directory: '.',
      outputFormat: 'both',
      renameFiles: 'yes',
      output: outputConfig,
    };
  }

  if (Object.keys(loadedConfig).length > 0) {
    const outputCfg = (loadedConfig as any).output || {};
    const renameConfig = (loadedConfig as any).rename || {};
    
    outputConfig = {
      ...outputConfig,
      directory: outputCfg.directory || outputConfig.directory,
      namingStyle: outputCfg.namingStyle || outputConfig.namingStyle,
      includeMetadata: outputCfg.includeMetadata || outputConfig.includeMetadata,
      captionLength: outputCfg.captionLength || outputConfig.captionLength,
    };
    
    skillConfig = {
      model: loadedConfig.model || skillConfig.model,
      directory: outputCfg.directory || '.',
      outputFormat: outputCfg.format || 'both',
      renameFiles: renameConfig.mode || 'yes',
      output: outputConfig,
    };
  }

  modelSelector = new ModelSelector(skillConfig.model);
}

function ensureOutputDirectory(): string {
  const outputDir = path.resolve(process.cwd(), outputConfig.directory);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

server.tool(
  'configure_model',
  'Configure the AI model for image analysis. Keys are stored in the MCP server config.json.',
  {
    provider: z.enum(['openai', 'anthropic', 'google', 'nvidia', 'alibaba', 'local']).optional(),
    model: z.string().optional(),
    apiKey: z.string().optional().describe('API key stored in MCP server config.json'),
    baseUrl: z.string().optional(),
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
  },
  async (params) => {
    try {
      const currentConfig = modelSelector.getConfig();
      const filteredParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined)
      );
      const newConfig = { ...currentConfig, ...filteredParams };

      skillConfig.model = newConfig;
      
      modelSelector.updateConfig(newConfig);

      return {
        content: [
          {
            type: 'text',
            text: `Model configured: ${newConfig.provider}/${newConfig.model}. API key saved to MCP server config.json.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error configuring model: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  'manage_api_keys',
  'Manage API keys stored in the MCP server. List, set, or remove keys for providers.',
  {
    action: z.enum(['list', 'set', 'remove']).describe('Action to perform'),
    provider: z.enum(['openai', 'anthropic', 'google', 'nvidia', 'alibaba', 'local']).optional().describe('Provider to manage'),
    apiKey: z.string().optional().describe('API key value (for set action)'),
    baseUrl: z.string().optional().describe('Base URL override (for set action)'),
  },
  async (params) => {
    try {
      const configPath = path.join(__dirname, '..', 'config.json');
      const serverConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      if (params.action === 'list') {
        const keys = Object.entries(serverConfig.models).map(([provider, config]: [string, any]) => ({
          provider,
          hasKey: !!config.apiKey && !config.apiKey.includes('your-'),
          baseUrl: config.baseUrl,
          defaultModel: config.defaultModel,
        }));
        return {
          content: [{ type: 'text', text: JSON.stringify({ activeProvider: serverConfig.activeProvider, keys }, null, 2) }],
        };
      }

      if (params.action === 'set') {
        if (!params.provider) return { content: [{ type: 'text', text: 'Provider required for set action' }], isError: true };
        if (!serverConfig.models[params.provider]) {
          serverConfig.models[params.provider] = { apiKey: '', baseUrl: '', defaultModel: '' };
        }
        if (params.apiKey) serverConfig.models[params.provider].apiKey = params.apiKey;
        if (params.baseUrl) serverConfig.models[params.provider].baseUrl = params.baseUrl;
        serverConfig.activeProvider = params.provider;
        fs.writeFileSync(configPath, JSON.stringify(serverConfig, null, 2));
        return { content: [{ type: 'text', text: `API key for ${params.provider} saved to config.json` }] };
      }

      if (params.action === 'remove') {
        if (!params.provider) return { content: [{ type: 'text', text: 'Provider required for remove action' }], isError: true };
        if (serverConfig.models[params.provider]) {
          serverConfig.models[params.provider].apiKey = '';
          fs.writeFileSync(configPath, JSON.stringify(serverConfig, null, 2));
          return { content: [{ type: 'text', text: `API key for ${params.provider} removed` }] };
        }
        return { content: [{ type: 'text', text: `Provider ${params.provider} not found` }], isError: true };
      }

      return { content: [{ type: 'text', text: 'Unknown action' }], isError: true };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error managing API keys: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  'configure_output',
  'Configure output settings: directory, saveToFile flag, formats, naming style.',
  {
    directory: z.string().optional().describe('Output directory path'),
    saveToFile: z.boolean().optional().describe('Whether to save results to files'),
    formats: z.array(z.enum(['normal', 'caveman', 'json', 'csv'])).optional().describe('Output formats to generate'),
    namingStyle: z.enum(['kebab-case', 'snake_case', 'camelCase', 'keep-original']).optional(),
    includeMetadata: z.enum(['full', 'basic', 'none']).optional(),
    captionLength: z.enum(['short', 'medium', 'detailed']).optional(),
  },
  async (params) => {
    try {
      const configPath = path.join(__dirname, '..', 'config.json');
      const serverConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      
      if (!serverConfig.output) serverConfig.output = {};
      
      if (params.directory !== undefined) serverConfig.output.directory = params.directory;
      if (params.saveToFile !== undefined) serverConfig.output.saveToFile = params.saveToFile;
      if (params.formats !== undefined) serverConfig.output.formats = params.formats;
      if (params.namingStyle !== undefined) serverConfig.output.namingStyle = params.namingStyle;
      if (params.includeMetadata !== undefined) serverConfig.output.includeMetadata = params.includeMetadata;
      if (params.captionLength !== undefined) serverConfig.output.captionLength = params.captionLength;
      
      fs.writeFileSync(configPath, JSON.stringify(serverConfig, null, 2));
      
      outputConfig = loadOutputConfig(serverConfig);
      
      return {
        content: [{ type: 'text', text: JSON.stringify({ message: 'Output config updated', config: outputConfig }, null, 2) }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error configuring output: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  'discover_images',
  'Discover images in a directory',
  {
    directory: z.string().optional(),
  },
  async (params) => {
    try {
      const dir = params.directory || skillConfig.directory;
      const images = await ImageProcessor.discoverImages(dir);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ count: images.length, files: images }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error discovering images: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  'extract_metadata',
  'Extract metadata from an image file',
  {
    imagePath: z.string(),
  },
  async (params) => {
    try {
      const metadata = await ImageProcessor.extractMetadata(params.imagePath);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(metadata, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error extracting metadata: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  'analyze_image',
  'Analyze an image using AI model',
  {
    imagePath: z.string(),
    prompt: z.string().optional(),
  },
  async (params) => {
    try {
      const metadata = await ImageProcessor.extractMetadata(params.imagePath);
      
      const defaultPrompt = `Describe this image in detail. Include:
1. Main subjects and objects
2. Colors and composition
3. Setting or context
4. Notable features

Then suggest a descriptive filename in ${outputConfig.namingStyle} format (under 60 chars, no extension).
Format your response as:
DESCRIPTION: [your detailed description]
CAPTION: [brief 1-2 sentence caption]
FILENAME: [suggested filename]`;

      const analysis = await modelSelector.analyzeImage(
        params.imagePath,
        params.prompt || defaultPrompt
      );

      const descriptionMatch = analysis.match(/DESCRIPTION:\s*(.+?)(?=CAPTION:|$)/s);
      const captionMatch = analysis.match(/CAPTION:\s*(.+?)(?=FILENAME:|$)/s);
      const filenameMatch = analysis.match(/FILENAME:\s*(.+)/);

      const description = descriptionMatch?.[1]?.trim() || analysis;
      const caption = captionMatch?.[1]?.trim() || '';
      const suggestedName = filenameMatch?.[1]?.trim() || ImageProcessor.generateFileName(
        description,
        outputConfig.namingStyle,
        path.basename(params.imagePath)
      );

      const ext = path.extname(params.imagePath);
      const fullSuggestedName = suggestedName.replace(/\.[^/.]+$/, '') + ext;

      const result: ImageAnalysis = {
        original: path.basename(params.imagePath),
        suggested: fullSuggestedName,
        metadata,
        description,
        caption,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error analyzing image: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  'describe_image',
  'Describe an image with optional deep study step. Use mode="quick" to save ~50% tokens.',
  {
    imagePath: z.string(),
    mode: z.enum(['quick', 'study']).optional().describe('quick=single step (~500 tokens), study=two-step deep analysis (~1500 tokens)'),
    style: z.enum(['documentary', 'artistic', 'technical', 'commercial']).optional().describe('Description style'),
    captionLength: z.enum(['short', 'medium', 'detailed']).optional().describe('Caption length preference'),
    includeMetadata: z.enum(['full', 'basic', 'none']).optional().describe('Metadata detail level'),
  },
  async (params) => {
    try {
      const metadata = await ImageProcessor.extractMetadata(params.imagePath);
      const mode = params.mode || 'quick';
      const style = params.style || 'documentary';
      const captionLength = params.captionLength || outputConfig.captionLength;
      const includeMetadata = params.includeMetadata || outputConfig.includeMetadata;

      const skillPath = path.join(__dirname, '..', 'skills', 'SKILL.md');
      let skillContent = '';
      if (fs.existsSync(skillPath)) {
        skillContent = fs.readFileSync(skillPath, 'utf-8');
      }

      const stylePrompts: Record<string, string> = {
        documentary: 'objective, factual, and detailed',
        artistic: 'evocative, poetic, and mood-focused',
        technical: 'precise, analytical, and specification-focused',
        commercial: 'engaging, marketing-oriented, and appealing',
      };

      const captionLengthGuide: Record<string, string> = {
        short: '1 concise sentence',
        medium: '2-3 sentences',
        detailed: 'a full paragraph with rich detail',
      };

      let studyResult = '';
      let describeResult: string;

      if (mode === 'study') {
        const studyPrompt = `You are an expert image analyst. Study this image carefully and analyze every detail.

Follow this structured analysis framework:

1. SUBJECTS: What are the main subjects? People, objects, animals, landscapes?
2. COMPOSITION: Rule of thirds, leading lines, framing, depth of field, perspective
3. LIGHTING: Direction, quality (harsh/soft), time of day, shadows, highlights
4. COLORS: Dominant palette, color harmony, saturation, contrast
5. TEXTURE & DETAIL: Surface qualities, patterns, fine details visible
6. MOOD & ATMOSPHERE: Emotional tone, weather, ambiance
7. TECHNICAL: Image quality, focus, noise, format characteristics
8. CONTEXT: Setting, location clues, cultural or historical elements

Format your study notes as structured bullet points. Be thorough and specific.
Include technical details: ${metadata.width}x${metadata.height}, ${metadata.format}, ${metadata.aspectRatio} ratio.`;

        studyResult = await modelSelector.analyzeImage(params.imagePath, studyPrompt);

        const describePrompt = `You are a professional image describer. Based on your detailed study notes below, write a polished ${stylePrompts[style]} image description.

SKILL GUIDELINES (from SKILL.md):
- Start with main subject/category
- Include key distinguishing features
- Follow naming conventions: ${outputConfig.namingStyle}
- Keep filenames under 60 characters
- Use lowercase only for filenames
- Replace spaces/special chars with separator
- Preserve original extension

STUDY NOTES:
${studyResult}

IMAGE METADATA:
- Dimensions: ${metadata.width}x${metadata.height}
- Aspect Ratio: ${metadata.aspectRatio}
- Format: ${metadata.format}
- File Size: ${Math.round(metadata.fileSize / 1024)} KB

Write a description in this style: ${stylePrompts[style]}

Include:
- A comprehensive paragraph describing the scene
- Key visual elements and their relationships
- The overall mood and atmosphere
- Any notable technical or artistic qualities

Format your response as:
DESCRIPTION: [your polished description paragraph]
CAPTION: [${captionLengthGuide[captionLength]} caption]
KEYWORDS: [5-8 comma-separated keywords]
FILENAME: [suggested ${outputConfig.namingStyle} filename, under 60 chars, no extension]`;

        describeResult = await modelSelector.analyzeImage(params.imagePath, describePrompt);
      } else {
        const quickPrompt = `You are a professional image describer. Analyze this image and write a ${stylePrompts[style]} description.

SKILL GUIDELINES (from SKILL.md):
- Start with main subject/category
- Include key distinguishing features
- Follow naming conventions: ${outputConfig.namingStyle}
- Keep filenames under 60 characters
- Use lowercase only for filenames
- Replace spaces/special chars with separator
- Preserve original extension

IMAGE METADATA:
- Dimensions: ${metadata.width}x${metadata.height}
- Aspect Ratio: ${metadata.aspectRatio}
- Format: ${metadata.format}
- File Size: ${Math.round(metadata.fileSize / 1024)} KB

Analyze: subjects, composition, lighting, colors, mood, and context.
Write a description in this style: ${stylePrompts[style]}

Format your response as:
DESCRIPTION: [your polished description paragraph]
CAPTION: [${captionLengthGuide[captionLength]} caption]
KEYWORDS: [5-8 comma-separated keywords]
FILENAME: [suggested ${outputConfig.namingStyle} filename, under 60 chars, no extension]`;

        describeResult = await modelSelector.analyzeImage(params.imagePath, quickPrompt);
      }

      const descriptionMatch = describeResult.match(/DESCRIPTION:\s*(.+?)(?=CAPTION:|$)/s);
      const captionMatch = describeResult.match(/CAPTION:\s*(.+?)(?=KEYWORDS:|$)/s);
      const keywordsMatch = describeResult.match(/KEYWORDS:\s*(.+?)(?=FILENAME:|$)/s);
      const filenameMatch = describeResult.match(/FILENAME:\s*(.+)/);

      const description = descriptionMatch?.[1]?.trim() || describeResult;
      const caption = captionMatch?.[1]?.trim() || '';
      const keywords = keywordsMatch?.[1]?.trim() || '';
      const suggestedName = filenameMatch?.[1]?.trim() || ImageProcessor.generateFileName(
        description,
        outputConfig.namingStyle,
        path.basename(params.imagePath)
      );

      const ext = path.extname(params.imagePath);
      const fullSuggestedName = suggestedName.replace(/\.[^/.]+$/, '') + ext;

      const result: Record<string, any> = {
        original: path.basename(params.imagePath),
        suggested: fullSuggestedName,
        mode,
        style,
        description,
        caption,
        keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
      };

      if (includeMetadata !== 'none') {
        result.metadata = includeMetadata === 'basic'
          ? { width: metadata.width, height: metadata.height, format: metadata.format, fileSize: metadata.fileSize }
          : metadata;
      }

      if (mode === 'study') {
        result.studyNotes = studyResult;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error describing image: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  'generate_report',
  'Generate image report in specified format. Saves to output directory if saveToFile is enabled.',
  {
    images: z.array(z.object({
      original: z.string(),
      suggested: z.string(),
      metadata: z.object({
        width: z.number(),
        height: z.number(),
        aspectRatio: z.string(),
        format: z.string(),
        fileSize: z.number(),
        created: z.string().optional(),
        modified: z.string(),
      }),
      description: z.string(),
      caption: z.string(),
    })),
    format: z.enum(['normal', 'caveman', 'json', 'csv']).optional(),
    outputFile: z.string().optional(),
  },
  async (params) => {
    try {
      const format = params.format || skillConfig.outputFormat;
      let report: string;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      switch (format) {
        case 'normal':
          report = ReportGenerator.generateNormalReport(params.images);
          break;
        case 'caveman':
          report = ReportGenerator.generateCavemanReport(params.images);
          break;
        case 'json':
          report = ReportGenerator.generateJSONReport(params.images);
          break;
        case 'csv':
          report = ReportGenerator.generateCSVReport(params.images);
          break;
        default:
          const normal = ReportGenerator.generateNormalReport(params.images);
          const caveman = ReportGenerator.generateCavemanReport(params.images);
          report = `# Normal Report\n\n${normal}\n\n# Caveman Report\n\n${caveman}`;
      }

      const savedFiles: string[] = [];

      if (outputConfig.saveToFile) {
        const outputDir = ensureOutputDirectory();
        
        if (params.outputFile) {
          const outputPath = path.isAbsolute(params.outputFile) ? params.outputFile : path.join(outputDir, params.outputFile);
          fs.writeFileSync(outputPath, report);
          savedFiles.push(outputPath);
        } else {
          const formatsToSave = format === 'both' ? ['normal', 'caveman'] : [format];
          
          for (const fmt of formatsToSave) {
            let content: string;
            let ext: string;
            
            switch (fmt) {
              case 'normal':
                content = ReportGenerator.generateNormalReport(params.images);
                ext = 'md';
                break;
              case 'caveman':
                content = ReportGenerator.generateCavemanReport(params.images);
                ext = 'md';
                break;
              case 'json':
                content = ReportGenerator.generateJSONReport(params.images);
                ext = 'json';
                break;
              case 'csv':
                content = ReportGenerator.generateCSVReport(params.images);
                ext = 'csv';
                break;
              default:
                continue;
            }
            
            const filename = `image_report_${timestamp}.${ext}`;
            const outputPath = path.join(outputDir, filename);
            fs.writeFileSync(outputPath, content);
            savedFiles.push(outputPath);
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              message: 'Report generated',
              savedFiles: outputConfig.saveToFile ? savedFiles : [],
              saveEnabled: outputConfig.saveToFile,
              report: report,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error generating report: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  'rename_images',
  'Rename image files based on analysis',
  {
    renames: z.array(z.object({
      from: z.string(),
      to: z.string(),
    })),
    preview: z.boolean().optional(),
  },
  async (params) => {
    try {
      const results = [];

      for (const { from, to } of params.renames) {
        if (params.preview) {
          results.push({ from, to, status: 'preview' });
          continue;
        }

        const dir = path.dirname(from);
        const toPath = path.join(dir, to);

        if (fs.existsSync(toPath)) {
          results.push({ from, to, status: 'skipped', reason: 'file exists' });
          continue;
        }

        fs.renameSync(from, toPath);
        results.push({ from, to, status: 'renamed' });
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error renaming images: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  'batch_analyze',
  'Batch analyze all images in a directory. Saves results to output directory if saveToFile is enabled.',
  {
    directory: z.string().optional(),
    customPrompt: z.string().optional(),
  },
  async (params) => {
    try {
      const dir = params.directory || skillConfig.directory;
      const images = await ImageProcessor.discoverImages(dir);
      const results: ImageAnalysis[] = [];

      for (const imagePath of images) {
        try {
          const metadata = await ImageProcessor.extractMetadata(imagePath);
          
          const defaultPrompt = `Describe this image in detail. Include:
1. Main subjects and objects
2. Colors and composition
3. Setting or context
4. Notable features

Then suggest a descriptive filename in ${outputConfig.namingStyle} format (under 60 chars, no extension).
Format your response as:
DESCRIPTION: [your detailed description]
CAPTION: [brief 1-2 sentence caption]
FILENAME: [suggested filename]`;

          const analysis = await modelSelector.analyzeImage(
            imagePath,
            params.customPrompt || defaultPrompt
          );

          const descriptionMatch = analysis.match(/DESCRIPTION:\s*(.+?)(?=CAPTION:|$)/s);
          const captionMatch = analysis.match(/CAPTION:\s*(.+?)(?=FILENAME:|$)/s);
          const filenameMatch = analysis.match(/FILENAME:\s*(.+)/);

          const description = descriptionMatch?.[1]?.trim() || analysis;
          const caption = captionMatch?.[1]?.trim() || '';
          const suggestedName = filenameMatch?.[1]?.trim() || ImageProcessor.generateFileName(
            description,
            outputConfig.namingStyle,
            path.basename(imagePath)
          );

          const ext = path.extname(imagePath);
          const fullSuggestedName = suggestedName.replace(/\.[^/.]+$/, '') + ext;

          results.push({
            original: path.basename(imagePath),
            suggested: fullSuggestedName,
            metadata,
            description,
            caption,
          });
        } catch (error) {
          console.error(`Error analyzing ${imagePath}:`, (error as Error).message);
        }
      }

      if (outputConfig.saveToFile && results.length > 0) {
        const outputDir = ensureOutputDirectory();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        
        const jsonOutput = path.join(outputDir, `analysis_${timestamp}.json`);
        fs.writeFileSync(jsonOutput, JSON.stringify({ analyzed: results.length, total: images.length, results }, null, 2));
        
        if (outputConfig.formats.includes('normal') || outputConfig.formats.includes('caveman')) {
          const normalReport = ReportGenerator.generateNormalReport(results);
          const normalOutput = path.join(outputDir, `report_normal_${timestamp}.md`);
          fs.writeFileSync(normalOutput, normalReport);
        }
        
        if (outputConfig.formats.includes('caveman')) {
          const cavemanReport = ReportGenerator.generateCavemanReport(results);
          const cavemanOutput = path.join(outputDir, `report_caveman_${timestamp}.md`);
          fs.writeFileSync(cavemanOutput, cavemanReport);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ analyzed: results.length, total: images.length, results }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error in batch analysis: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function main() {
  initializeConfig();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('Image Report MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
