#!/usr/bin/env node
/**
 * Token Manager - CLI script to save/manage API tokens for MCP server
 * 
 * Usage:
 *   node scripts/manage-token.js list
 *   node scripts/manage-token.js set <provider> <api-key>
 *   node scripts/manage-token.js remove <provider>
 *   node scripts/manage-token.js active <provider>
 *   node scripts/manage-token.js show
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

const PROVIDERS = {
  alibaba: {
    name: 'Alibaba (DashScope)',
    models: ['qwen-vl-max-latest', 'qwen-vl-plus-latest', 'qwen3-vl-235b-a22b-instruct'],
    envKey: 'DASHSCOPE_API_KEY',
  },
  nvidia: {
    name: 'NVIDIA NIM',
    models: ['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', 'nvidia/nemotron-ocr-v1'],
    envKey: 'NVIDIA_API_KEY',
  },
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4-vision-preview'],
    envKey: 'OPENAI_API_KEY',
  },
  anthropic: {
    name: 'Anthropic',
    models: ['claude-sonnet-4-20250514', 'claude-3-opus-20240229'],
    envKey: 'ANTHROPIC_API_KEY',
  },
  google: {
    name: 'Google (Gemini)',
    models: ['gemini-2.5-flash', 'gemini-pro-vision'],
    envKey: 'GOOGLE_API_KEY',
  },
  local: {
    name: 'Local (Ollama)',
    models: ['qwen2.5-vl'],
    envKey: null,
  },
};

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('Error: config.json not found');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function maskKey(key) {
  if (!key || key.includes('your-') || key.length < 10) return '*** not set ***';
  return key.substring(0, 8) + '...' + key.substring(key.length - 4);
}

function cmdList() {
  const config = loadConfig();
  console.log('\n=== API Token Status ===\n');
  
  for (const [provider, info] of Object.entries(PROVIDERS)) {
    const modelConfig = config.models[provider];
    const hasKey = modelConfig?.apiKey && !modelConfig.apiKey.includes('your-');
    const isActive = config.activeProvider === provider;
    
    console.log(`${isActive ? '🟢' : hasKey ? '🟡' : '⚪'} ${info.name} (${provider})`);
    console.log(`   API Key: ${maskKey(modelConfig?.apiKey || '')}`);
    console.log(`   Base URL: ${modelConfig?.baseUrl || 'not set'}`);
    console.log(`   Default Model: ${modelConfig?.defaultModel || 'not set'}`);
    console.log('');
  }
  
  console.log(`Active provider: ${config.activeProvider}`);
  console.log(`Active model: ${config.activeModel}`);
}

function cmdSet(provider, apiKey) {
  if (!PROVIDERS[provider]) {
    console.error(`Error: Unknown provider "${provider}"`);
    console.error(`Available: ${Object.keys(PROVIDERS).join(', ')}`);
    process.exit(1);
  }
  
  if (!apiKey) {
    console.error('Error: API key is required');
    console.error('Usage: node scripts/manage-token.js set <provider> <api-key>');
    process.exit(1);
  }
  
  const config = loadConfig();
  
  if (!config.models[provider]) {
    config.models[provider] = { apiKey: '', baseUrl: '', defaultModel: PROVIDERS[provider].models[0] };
  }
  
  config.models[provider].apiKey = apiKey;
  config.activeProvider = provider;
  config.activeModel = config.models[provider].defaultModel;
  
  saveConfig(config);
  
  console.log(`\n✅ Token saved for ${PROVIDERS[provider].name} (${provider})`);
  console.log(`   API Key: ${maskKey(apiKey)}`);
  console.log(`   Active provider set to: ${provider}`);
  console.log(`   Active model set to: ${config.activeModel}`);
}

function cmdRemove(provider) {
  if (!PROVIDERS[provider]) {
    console.error(`Error: Unknown provider "${provider}"`);
    process.exit(1);
  }
  
  const config = loadConfig();
  
  if (config.models[provider]) {
    config.models[provider].apiKey = '';
    saveConfig(config);
    console.log(`\n✅ Token removed for ${PROVIDERS[provider].name} (${provider})`);
  } else {
    console.log(`\nNo token found for ${provider}`);
  }
}

function cmdActive(provider) {
  if (!PROVIDERS[provider]) {
    console.error(`Error: Unknown provider "${provider}"`);
    process.exit(1);
  }
  
  const config = loadConfig();
  
  if (!config.models[provider]?.apiKey || config.models[provider].apiKey.includes('your-')) {
    console.error(`\n⚠️ Warning: No valid API key set for ${provider}`);
    console.error(`Run: node scripts/manage-token.js set ${provider} <your-key>`);
  }
  
  config.activeProvider = provider;
  config.activeModel = config.models[provider]?.defaultModel || PROVIDERS[provider].models[0];
  
  saveConfig(config);
  
  console.log(`\n✅ Active provider set to: ${provider}`);
  console.log(`   Active model: ${config.activeModel}`);
}

function cmdShow() {
  const config = loadConfig();
  const provider = config.activeProvider;
  const info = PROVIDERS[provider];
  
  console.log('\n=== Current Configuration ===\n');
  console.log(`Provider: ${info?.name || provider} (${provider})`);
  console.log(`Model: ${config.activeModel}`);
  console.log(`API Key: ${maskKey(config.models[provider]?.apiKey || '')}`);
  console.log(`Base URL: ${config.models[provider]?.baseUrl || 'not set'}`);
  console.log(`Max Tokens: ${config.maxTokens || 2048}`);
  console.log(`Temperature: ${config.temperature ?? 0.7}`);
}

// Parse CLI arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'list':
    cmdList();
    break;
  case 'set':
    cmdSet(args[1], args[2]);
    break;
  case 'remove':
    cmdRemove(args[1]);
    break;
  case 'active':
    cmdActive(args[1]);
    break;
  case 'show':
    cmdShow();
    break;
  default:
    console.log(`
Token Manager - Manage API tokens for MCP Image Factory

Usage:
  node scripts/manage-token.js list                  - List all providers and token status
  node scripts/manage-token.js set <provider> <key>  - Save API token for a provider
  node scripts/manage-token.js remove <provider>     - Remove API token
  node scripts/manage-token.js active <provider>     - Set active provider
  node scripts/manage-token.js show                  - Show current configuration

Providers:
  alibaba   - Alibaba DashScope (Qwen-VL models)
  nvidia    - NVIDIA NIM (Nemotron models)
  openai    - OpenAI (GPT-4o, etc.)
  anthropic - Anthropic (Claude models)
  google    - Google (Gemini models)
  local     - Local Ollama instance

Examples:
  node scripts/manage-token.js set alibaba sk-your-key-here
  node scripts/manage-token.js set nvidia nvapi-your-key-here
  node scripts/manage-token.js active alibaba
  node scripts/manage-token.js list
`);
}
