import { ModelConfig } from './types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
}

interface McpServerConfig {
  models: Record<string, ProviderConfig>;
  activeProvider: string;
  activeModel: string;
  maxTokens: number;
  temperature: number;
}

export class ModelSelector {
  private config: ModelConfig;
  private serverConfigPath: string;

  constructor(config: ModelConfig) {
    this.config = config;
    this.serverConfigPath = path.join(__dirname, '..', 'config.json');
  }

  private loadServerConfig(): McpServerConfig | null {
    try {
      if (fs.existsSync(this.serverConfigPath)) {
        return JSON.parse(fs.readFileSync(this.serverConfigPath, 'utf-8'));
      }
    } catch {
      return null;
    }
    return null;
  }

  private saveServerConfig(serverConfig: McpServerConfig): void {
    fs.writeFileSync(this.serverConfigPath, JSON.stringify(serverConfig, null, 2));
  }

  getApiKey(provider?: string): string {
    const p = provider || this.config.provider;
    const serverConfig = this.loadServerConfig();
    if (serverConfig?.models[p]?.apiKey) {
      return serverConfig.models[p].apiKey;
    }
    const envKeys: Record<string, string> = {
      alibaba: 'DASHSCOPE_API_KEY',
      nvidia: 'NVIDIA_API_KEY',
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      google: 'GOOGLE_API_KEY',
    };
    return process.env[envKeys[p] || ''] || '';
  }

  getBaseUrl(provider?: string): string {
    const p = provider || this.config.provider;
    const serverConfig = this.loadServerConfig();
    if (serverConfig?.models[p]?.baseUrl) {
      return serverConfig.models[p].baseUrl;
    }
    const defaults: Record<string, string> = {
      alibaba: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      nvidia: 'https://integrate.api.nvidia.com/v1',
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      google: 'https://generativelanguage.googleapis.com/v1beta',
    };
    return defaults[p] || '';
  }

  updateConfig(config: Partial<ModelConfig>) {
    this.config = { ...this.config, ...config };
    
    const serverConfig = this.loadServerConfig();
    if (serverConfig) {
      if (config.provider) serverConfig.activeProvider = config.provider;
      if (config.model) serverConfig.activeModel = config.model;
      if (config.apiKey && config.provider) {
        if (!serverConfig.models[config.provider]) {
          serverConfig.models[config.provider] = { apiKey: '', baseUrl: '', defaultModel: '' };
        }
        serverConfig.models[config.provider].apiKey = config.apiKey;
      }
      if (config.baseUrl && config.provider) {
        if (!serverConfig.models[config.provider]) {
          serverConfig.models[config.provider] = { apiKey: '', baseUrl: '', defaultModel: '' };
        }
        serverConfig.models[config.provider].baseUrl = config.baseUrl;
      }
      if (config.maxTokens) serverConfig.maxTokens = config.maxTokens;
      if (config.temperature) serverConfig.temperature = config.temperature;
      this.saveServerConfig(serverConfig);
    }
  }

  getConfig(): ModelConfig {
    return this.config;
  }

  async analyzeImage(imagePath: string, prompt: string): Promise<string> {
    const { provider, model, apiKey, baseUrl, maxTokens, temperature } = this.config;

    switch (provider) {
      case 'openai':
        return this.callOpenAI(imagePath, prompt, { model, apiKey, baseUrl, maxTokens, temperature });
      case 'anthropic':
        return this.callAnthropic(imagePath, prompt, { model, apiKey, baseUrl, maxTokens, temperature });
      case 'google':
        return this.callGoogle(imagePath, prompt, { model, apiKey, baseUrl, maxTokens, temperature });
      case 'nvidia':
        return this.callNVIDIA(imagePath, prompt, { model, apiKey, baseUrl, maxTokens, temperature });
      case 'alibaba':
        return this.callAlibaba(imagePath, prompt, { model, apiKey, baseUrl, maxTokens, temperature });
      case 'local':
        return this.callLocal(imagePath, prompt, { model, apiKey, baseUrl, maxTokens, temperature });
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private async callOpenAI(
    imagePath: string,
    prompt: string,
    config: { model: string; apiKey?: string; baseUrl?: string; maxTokens: number; temperature: number }
  ): Promise<string> {
    const fs = await import('fs');
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const apiKey = config.apiKey || this.getApiKey('openai');
    const baseUrl = config.baseUrl || this.getBaseUrl('openai');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async callAnthropic(
    imagePath: string,
    prompt: string,
    config: { model: string; apiKey?: string; baseUrl?: string; maxTokens: number; temperature: number }
  ): Promise<string> {
    const fs = await import('fs');
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const apiKey = config.apiKey || this.getApiKey('anthropic');
    const baseUrl = config.baseUrl || this.getBaseUrl('anthropic');

    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    return data.content[0].text;
  }

  private async callGoogle(
    imagePath: string,
    prompt: string,
    config: { model: string; apiKey?: string; baseUrl?: string; maxTokens: number; temperature: number }
  ): Promise<string> {
    const fs = await import('fs');
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const apiKey = config.apiKey || this.getApiKey('google');
    const baseUrl = config.baseUrl || this.getBaseUrl('google');

    const response = await fetch(
      `${baseUrl}/models/${config.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: config.maxTokens,
            temperature: config.temperature,
          },
        }),
      }
    );

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  private async callNVIDIA(
    imagePath: string,
    prompt: string,
    config: { model: string; apiKey?: string; baseUrl?: string; maxTokens: number; temperature: number }
  ): Promise<string> {
    const fs = await import('fs');
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const apiKey = config.apiKey || this.getApiKey('nvidia');
    const baseUrl = config.baseUrl || this.getBaseUrl('nvidia');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async callAlibaba(
    imagePath: string,
    prompt: string,
    config: { model: string; apiKey?: string; baseUrl?: string; maxTokens: number; temperature: number }
  ): Promise<string> {
    const fs = await import('fs');
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const apiKey = config.apiKey || this.getApiKey('alibaba');
    const baseUrl = config.baseUrl || this.getBaseUrl('alibaba');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async callLocal(
    imagePath: string,
    prompt: string,
    config: { model: string; apiKey?: string; baseUrl?: string; maxTokens: number; temperature: number }
  ): Promise<string> {
    if (!config.baseUrl) {
      throw new Error('baseUrl is required for local provider');
    }

    const fs = await import('fs');
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey || 'local'}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content;
  }
}
