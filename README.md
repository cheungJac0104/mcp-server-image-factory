# Image Report MCP Server

MCP (Model Context Protocol) server for the image-report skill with centralized AI model selection.

## Features

- **Centralized Model Selection**: Configure once, use across all image analysis tasks
- **Multi-Provider Support**: OpenAI, Anthropic, Google, and local models
- **Image Analysis**: AI-powered image description and captioning
- **Metadata Extraction**: Technical image details (dimensions, format, EXIF)
- **Smart Renaming**: Generate descriptive filenames based on image content
- **Multiple Report Formats**: Normal, caveman, JSON, and CSV outputs

## Installation

```bash
cd .agents/skills/image-report/mcp-server
npm install
npm run build
```

## Configuration

### API Keys (Stored in MCP Server)

API keys are stored locally in `mcp-server/config.json` - not in opencode.json or environment variables.

**Edit `config.json` directly:**

```json
{
  "models": {
    "alibaba": {
      "apiKey": "sk-your-key-here",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "defaultModel": "qwen-vl-max-latest"
    },
    "nvidia": {
      "apiKey": "nvapi-your-key-here",
      "baseUrl": "https://integrate.api.nvidia.com/v1",
      "defaultModel": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
    }
  },
  "activeProvider": "alibaba",
  "activeModel": "qwen-vl-max-latest"
}
```

**Or use the `manage_api_keys` MCP tool:**

```json
// List all keys
{ "tool": "manage_api_keys", "arguments": { "action": "list" } }

// Set a key
{ "tool": "manage_api_keys", "arguments": { "action": "set", "provider": "alibaba", "apiKey": "sk-xxx" } }

// Remove a key
{ "tool": "manage_api_keys", "arguments": { "action": "remove", "provider": "alibaba" } }
```

**Or use the `configure_model` tool** (auto-saves key to config.json):

```json
{
  "tool": "configure_model",
  "arguments": {
    "provider": "alibaba",
    "model": "qwen-vl-max-latest",
    "apiKey": "sk-xxx"
  }
}
```

### Token Manager CLI

A convenient CLI script to manage API tokens without editing config files manually.

```bash
# List all providers and token status
npm run token:list
# or
node scripts/manage-token.js list

# Show current active configuration
npm run token:show
# or
node scripts/manage-token.js show

# Save API token for a provider (also sets as active)
node scripts/manage-token.js set alibaba sk-your-key-here
node scripts/manage-token.js set nvidia nvapi-your-key-here
node scripts/manage-token.js set openai sk-your-openai-key

# Switch active provider
node scripts/manage-token.js active alibaba

# Remove API token for a provider
node scripts/manage-token.js remove alibaba
```

**Available Providers:**
| Provider | Description |
|----------|-------------|
| `alibaba` | Alibaba DashScope (Qwen-VL models) |
| `nvidia` | NVIDIA NIM (Nemotron models) |
| `openai` | OpenAI (GPT-4o, etc.) |
| `anthropic` | Anthropic (Claude models) |
| `google` | Google (Gemini models) |
| `local` | Local Ollama instance |

### Output Settings (via opencode.json)

Report format, naming style, and other output options are still configured in `opencode.json`:

```json
{
  "imageReport": {
    "output": {
      "format": "both",
      "namingStyle": "kebab-case",
      "includeMetadata": "full",
      "captionLength": "medium"
    },
    "rename": { "enabled": true, "mode": "yes" }
  }
}
```

### Fallback

If no key is found in `config.json`, the server falls back to environment variables (`DASHSCOPE_API_KEY`, `NVIDIA_API_KEY`, etc.).

### Model Providers

| Provider | Example Models | Required Env | Base URL |
|----------|---------------|--------------|----------|
| `alibaba` | `qwen-vl-max-latest`, `qwen-vl-plus-latest` | `DASHSCOPE_API_KEY` | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `nvidia` | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | `NVIDIA_API_KEY` | `https://integrate.api.nvidia.com/v1` |
| `openai` | `gpt-4-vision-preview`, `gpt-4o` | `OPENAI_API_KEY` | `https://api.openai.com/v1` |
| `anthropic` | `claude-3-opus-20240229` | `ANTHROPIC_API_KEY` | `https://api.anthropic.com/v1` |
| `google` | `gemini-pro-vision` | `GOOGLE_API_KEY` | `https://generativelanguage.googleapis.com/v1beta` |
| `local` | Any OpenAI-compatible model | None | Custom |

### Alibaba Bailian (DashScope) Models

#### Vision-Language Models (Image-to-Text)
| Model ID | Description |
|----------|-------------|
| `qwen-vl-max-latest` | Qwen-VL Max latest, best vision understanding |
| `qwen-vl-max` | Qwen-VL Max, strong vision reasoning |
| `qwen-vl-plus-latest` | Qwen-VL Plus latest, balanced performance |
| `qwen-vl-plus` | Qwen-VL Plus, cost-effective vision |
| `qwen-vl-max-0813` | Qwen-VL Max 2024-08-13 version |
| `qwen-vl-plus-0815` | Qwen-VL Plus 2024-08-15 version |
| `qwen-vl-plus-0710` | Qwen-VL Plus 2024-07-10 version |

#### Qwen3 Series (Multimodal)
| Model ID | Description |
|----------|-------------|
| `qwen3-vl-235b-a22b-thinking` | Qwen3-VL 235B thinking mode |
| `qwen3-vl-235b-a22b-instruct` | Qwen3-VL 235B instruct mode |
| `qwen3-vl-72b-instruct` | Qwen3-VL 72B instruct |
| `qwen3.5-vl` | Qwen3.5-VL latest |
| `qwen3.5-omni` | Qwen3.5-Omni multimodal |

#### Qwen3 Text Models (Can Accept Images)
| Model ID | Description |
|----------|-------------|
| `qwen3.6` | Qwen3.6 latest, strongest text |
| `qwen3.5` | Qwen3.5 latest |
| `qwen3-max` | Qwen3 Max, powerful reasoning |
| `qwen3-max-preview` | Qwen3 Max preview |
| `qwen3-plus` | Qwen3 Plus, balanced |
| `qwen3-turbo` | Qwen3 Turbo, fast |
| `qwen3-flash` | Qwen3 Flash, lightweight |

#### QVQ (Visual Reasoning)
| Model ID | Description |
|----------|-------------|
| `qvq-72b-preview` | QVQ 72B visual reasoning |
| `qwen3-vl-thinking` | Qwen3-VL thinking mode |

#### Qwen-Omni (Audio+Vision)
| Model ID | Description |
|----------|-------------|
| `qwen3-omni-flash` | Qwen3-Omni Flash fast mode |
| `qwen2.5-omni-7b` | Qwen2.5-Omni 7B |

#### Qwen-Coder (Code + Vision)
| Model ID | Description |
|----------|-------------|
| `qwen3-coder-plus` | Qwen3-Coder Plus |
| `qwen3-coder` | Qwen3-Coder latest |
| `qwen2.5-coder-32b-instruct` | Qwen2.5-Coder 32B |

#### Qwen-Math (Math + Vision)
| Model ID | Description |
|----------|-------------|
| `qwen3-math` | Qwen3 Math latest |
| `qwen2.5-math-72b-instruct` | Qwen2.5-Math 72B |

#### Legacy Models
| Model ID | Description |
|----------|-------------|
| `qwen-max` | Qwen Max legacy |
| `qwen-max-latest` | Qwen Max latest legacy |
| `qwen-plus` | Qwen Plus legacy |
| `qwen-plus-latest` | Qwen Plus latest legacy |
| `qwen-turbo` | Qwen Turbo legacy |
| `qwen-flash` | Qwen Flash legacy |
| `qwen-long` | Qwen Long, 10M context |

### NVIDIA NIM Models (Image-to-Text)

| Model ID | Description |
|----------|-------------|
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | Omni-modal reasoning for images, video, speech, text |
| `nvidia/nemotron-ocr-v1` | OCR for text extraction, layout, and structure analysis |
| `moonshotai/kimi-k2.6` | 1T multimodal MoE for image/video understanding |
| `mistralai/mistral-small-4-119b-2603` | Hybrid MoE with multimodal input, 256k context |
| `google/gemma-4-31b-it` | Dense 31B model with frontier reasoning |

## Usage

### Start the Server

```bash
npm start
# or for development
npm run dev
```

### MCP Tools

The server exposes the following tools:

1. **`configure_model`** - Set the AI model and provider
2. **`discover_images`** - Find images in a directory
3. **`extract_metadata`** - Get technical image details
4. **`analyze_image`** - AI-powered image analysis
5. **`generate_report`** - Create reports in various formats
6. **`rename_images`** - Rename files based on analysis
7. **`batch_analyze`** - Process all images in a directory

### Example: Configure Model

```json
{
  "tool": "configure_model",
  "arguments": {
    "provider": "anthropic",
    "model": "claude-3-opus-20240229"
  }
}
```

### Example: Batch Analyze

```json
{
  "tool": "batch_analyze",
  "arguments": {
    "directory": "./photos"
  }
}
```

### Example: Generate Report

```json
{
  "tool": "generate_report",
  "arguments": {
    "images": [...],
    "format": "json",
    "outputFile": "image_report.json"
  }
}
```

### Image Modifier CLI

A powerful CLI tool for image manipulation: compress, resize, rotate, convert, and more.

```bash
# Show help
npm run img

# Compress images (reduce file size)
npm run img:compress <input> -q 70 -o ./output
npm run img:compress ./photos -q 60 -r -o ./compressed

# Resize images
npm run img:resize photo.jpg -w 800 -h 600
npm run img:resize photo.jpg -p 50              # Scale to 50%
npm run img:resize ./photos -w 1920 -h 1080 -r  # Batch resize

# Rotate images
npm run img:rotate photo.jpg -d 90
npm run img:rotate photo.jpg -d 180

# Convert format
npm run img:convert photo.png -f webp
npm run img:convert ./photos -f jpg -q 85 -r

# Batch process (combine multiple operations)
npm run img:batch ./photos --resize 1920x1080 --compress 80 -o ./output
npm run img:batch ./photos --rotate 90 --grayscale -o ./output
npm run img:batch ./photos --resize 800x600 --blur 2 --compress 70 -o ./output
```

**Available Commands:**

| Command | Description | Key Options |
|---------|-------------|-------------|
| `compress` | Compress image(s) | `-q` quality, `-p` png level, `-r` recursive |
| `resize` | Resize by dimensions or % | `-w` width, `-h` height, `-p` percent, `-f` fit mode |
| `rotate` | Rotate by degrees | `-d` degrees (90/180/270) |
| `convert` | Change image format | `-f` format (jpg/png/webp/tiff/avif) |
| `quality` | Adjust quality only | `-q` quality 1-100 |
| `grayscale` | Convert to B&W | `-o` output dir |
| `blur` | Apply blur effect | `-s` sigma (0.3-1000) |
| `flip` | Flip/flop image | `-d` direction (horizontal/vertical) |
| `crop` | Crop to region | `-x` left, `-y` top, `-w` width, `-h` height |
| `batch` | Multiple operations | `--resize`, `--compress`, `--rotate`, `--grayscale`, `--blur`, `--flip` |

**Common Options:**
- `-o, --output <dir>` - Output directory
- `-r, --recursive` - Process subdirectories
- `-s, --suffix <str>` - Output filename suffix

### Integration with OpenCode

Add to your `.opencode/config.json`:

```json
{
  "mcpServers": {
    "image-report": {
      "command": "node",
      "args": ["path/to/image-report-mcp-server/dist/index.js"],
      "cwd": "path/to/your/image/directory"
    }
  }
}
```

## API Reference

### configure_model

Configure the AI model for image analysis.

**Parameters:**
- `provider` - AI provider (openai, anthropic, google, local)
- `model` - Model name
- `apiKey` - API key (optional, can use env vars)
- `baseUrl` - Custom API endpoint (for local models)
- `maxTokens` - Maximum tokens for response
- `temperature` - Sampling temperature (0-1)

### discover_images

Find all images in a directory.

**Parameters:**
- `directory` - Path to search (default: current directory)

**Returns:** Array of image file paths

### extract_metadata

Extract technical metadata from an image.

**Parameters:**
- `imagePath` - Full path to image file

**Returns:** Width, height, aspect ratio, format, file size, dates

### analyze_image

Analyze a single image using AI.

**Parameters:**
- `imagePath` - Full path to image file
- `prompt` - Custom analysis prompt (optional)

**Returns:** Description, caption, suggested filename, metadata

### generate_report

Create a formatted report from analyzed images.

**Parameters:**
- `images` - Array of image analysis results
- `format` - Output format (normal, caveman, json, csv)
- `outputFile` - Save to file (optional)

**Returns:** Formatted report string

### rename_images

Rename image files based on analysis.

**Parameters:**
- `renames` - Array of {from, to} objects
- `preview` - Show what would be renamed without doing it

**Returns:** Array of rename results with status

### batch_analyze

Analyze all images in a directory.

**Parameters:**
- `directory` - Path to process
- `customPrompt` - Override default analysis prompt

**Returns:** Array of all image analyses

## License

MIT
