---
name: image-report
description: Describe, rename, and report on images with metadata and captions. Configurable output formats and naming conventions.
---

# Image Report Skill

Describe images, extract metadata, generate captions, rename files, and export reports in multiple formats.

## Parameters

Ask user for preferences before starting:

| Parameter | Options | Default |
|-----------|---------|---------|
| **Directory** | Any path | Current working directory |
| **Output Format** | `normal`, `caveman`, `both`, `json`, `csv` | `both` |
| **Rename Files** | `yes`, `no`, `preview-only` | `yes` |
| **Naming Style** | `kebab-case`, `snake_case`, `camelCase`, `keep-original` | `kebab-case` |
| **Include Metadata** | `full`, `basic`, `none` | `full` |
| **Caption Length** | `short` (1 line), `medium` (2-3 lines), `detailed` (paragraph) | `medium` |

## Workflow

### Step 1: Discover Images
```
Glob patterns: *.{jpg,jpeg,png,gif,bmp,webp,svg,tiff,ico,heic,raw}
Filter: Skip hidden files, skip already-renamed files (optional)
```

### Step 2: Extract Metadata
```python
# Use Python PIL for image-specific metadata
from PIL import Image
import os

# Extract: dimensions, aspect ratio, color mode, format, file size, EXIF data (if available)
# Fallback: file system stats (created, modified, size)
```

### Step 3: Analyze Images
```
Use `read` tool to view each image
Generate: description, caption, suggested filename
```

### Step 4: Generate Output

#### Normal Report (`image_report_normal.md`)
```markdown
# Image Report

## [Image Number]: [Descriptive Title]
**Original:** [original filename]
**Rename:** [suggested filename]

### Metadata
- Dimensions: WxH
- Aspect Ratio: X:Y
- Format: JPEG/PNG/etc
- File Size: XX KB
- Created: YYYY-MM-DD HH:MM
- Modified: YYYY-MM-DD HH:MM

### Description
[2-5 sentence detailed visual description]

### Caption
[1-2 sentence summary]

---

## Summary Table
| # | Original | New Name | Dimensions | Size |
|---|----------|----------|------------|------|
```

#### Caveman Report (`image_report_caveman.md`)
```markdown
# Image Report - Caveman

## IMG[N]: [new-name.ext]
**Was:** [original]

### Meta
- Size: WxH | Ratio | Format | XX KB | Date

### Desc
[1-2 sentence compressed description]

### Caption
[Brief caption]

---

## Summary
| # | Was | Now | Size | KB |
```

#### JSON Output (`image_report.json`)
```json
{
  "images": [
    {
      "original": "filename.jpg",
      "suggested": "new-name.jpg",
      "metadata": {...},
      "description": "...",
      "caption": "..."
    }
  ]
}
```

#### CSV Output (`image_report.csv`)
```csv
original,suggested,width,height,format,size_kb,description,caption
```

### Step 5: Rename Files (if enabled)
```powershell
# PowerShell
Rename-Item -LiteralPath "old.jpg" -NewName "new.jpg"

# Or preview mode: just show what would be renamed
```

## Naming Conventions

### Kebab-Case (Default)
`disney-duffy-friends-tonie-olu-plush-keychain.jpg`

### Snake_Case
`disney_duffy_friends_tonie_olu_plush_keychain.jpg`

### CamelCase
`disneyDuffyFriendsTonieOluPlushKeychain.jpg`

### Naming Rules
1. Start with main subject/category
2. Include key distinguishing features
3. Keep under 60 characters
4. Use lowercase only
5. Replace spaces/special chars with separator
6. Preserve original extension

## Edge Cases

| Scenario | Handling |
|----------|----------|
| No images found | Report "No images found in directory" |
| Image read fails | Skip with warning, continue others |
| Duplicate suggested names | Add numeric suffix: `name-1.jpg`, `name-2.jpg` |
| Very large files (>10MB) | Note in report, skip detailed analysis |
| Corrupted files | Report error, skip |
| Mixed orientations | Note portrait/landscape in metadata |

## MCP Server Integration

This skill includes an MCP server for centralized model selection and programmatic access.

### Setup

```bash
cd .agents/skills/image-report/mcp-server
npm install
npm run build
```

### Configuration via opencode.json

Add to your project's `opencode.json`:

```json
{
  "mcp": {
    "image-report": {
      "type": "local",
      "command": ["node", ".agents/skills/image-report/mcp-server/dist/index.js"],
      "enabled": true
    }
  },
  "imageReport": {
    "output": { "format": "both", "namingStyle": "kebab-case" },
    "rename": { "enabled": true, "mode": "yes" }
  }
}
```

### API Keys (MCP Server Internal)

API keys are stored in `mcp-server/config.json`, NOT in opencode.json. Use the `manage_api_keys` tool or edit `config.json` directly.

Config precedence: `mcp-server/config.json` (keys) + `opencode.json` (output settings) > env vars (fallback)

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `configure_model` | Set AI provider and model |
| `discover_images` | Find images in directory |
| `extract_metadata` | Get image technical details |
| `analyze_image` | AI-powered image analysis |
| `generate_report` | Create formatted reports |
| `rename_images` | Rename files based on analysis |
| `batch_analyze` | Process all images at once |

### Supported Providers

- **Alibaba Bailian**: qwen-vl-max-latest, qwen-vl-plus-latest, qwen3-vl-235b-a22b, qwen3.5-vl, qvq-72b-preview, qwen3-coder, qwen3-math, qwen-max, qwen-plus, qwen-turbo, qwen-long (50+ models)
- **NVIDIA NIM**: nemotron-3-nano-omni-30b-a3b-reasoning, nemotron-ocr-v1, kimi-k2.6, mistral-small-4-119b, gemma-4-31b-it
- **OpenAI**: gpt-4-vision-preview, gpt-4o
- **Anthropic**: claude-3-opus, claude-3-sonnet
- **Google**: gemini-pro-vision, gemini-ultra-vision
- **Local**: Any OpenAI-compatible endpoint

See `mcp-server/README.md` for full documentation.

## Trigger Phrases

- "describe and rename images"
- "generate image report"
- "catalog images"
- "image-report"
- "analyze images in [directory]"
- "create image catalog"
- "document images"
- "use mcp server for images"

## Examples

### Example 1: Quick catalog
```
User: "catalog images in ./photos"
Agent: Asks format preference, generates both reports
```

### Example 2: Rename only
```
User: "rename images with kebab-case, no report"
Agent: Renames files, shows summary table only
```

### Example 3: JSON export
```
User: "export image metadata as JSON"
Agent: Generates image_report.json with full metadata
```
