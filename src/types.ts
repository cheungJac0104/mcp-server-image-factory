import { z } from 'zod';

export const ModelConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'nvidia', 'alibaba', 'local']).default('alibaba'),
  model: z.string().default('qwen-vl-max-latest'),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  maxTokens: z.number().default(2048),
  temperature: z.number().default(0.7),
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

export const OutputConfigSchema = z.object({
  directory: z.string().default('./output'),
  saveToFile: z.boolean().default(true),
  formats: z.array(z.enum(['normal', 'caveman', 'json', 'csv'])).default(['normal', 'caveman', 'json']),
  namingStyle: z.enum(['kebab-case', 'snake_case', 'camelCase', 'keep-original']).default('kebab-case'),
  includeMetadata: z.enum(['full', 'basic', 'none']).default('full'),
  captionLength: z.enum(['short', 'medium', 'detailed']).default('medium'),
});

export type OutputConfig = z.infer<typeof OutputConfigSchema>;

export const SkillConfigSchema = z.object({
  model: ModelConfigSchema,
  output: OutputConfigSchema,
  directory: z.string().default('.'),
  outputFormat: z.enum(['normal', 'caveman', 'both', 'json', 'csv']).default('both'),
  renameFiles: z.enum(['yes', 'no', 'preview-only']).default('yes'),
});

export type SkillConfig = z.infer<typeof SkillConfigSchema>;

export const ImageMetadataSchema = z.object({
  width: z.number(),
  height: z.number(),
  aspectRatio: z.string(),
  format: z.string(),
  fileSize: z.number(),
  colorMode: z.string().optional(),
  exif: z.record(z.any()).optional(),
  created: z.string().optional(),
  modified: z.string(),
});

export type ImageMetadata = z.infer<typeof ImageMetadataSchema>;

export const ImageAnalysisSchema = z.object({
  original: z.string(),
  suggested: z.string(),
  metadata: ImageMetadataSchema,
  description: z.string(),
  caption: z.string(),
});

export type ImageAnalysis = z.infer<typeof ImageAnalysisSchema>;
