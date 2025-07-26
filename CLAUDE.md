# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build
```bash
npm run build
```
Compiles TypeScript files from `src/` to `dist/` using the TypeScript compiler.

### Format
```bash
npm run format
```
Formats all TypeScript files in the `src/` directory using Prettier.

### Install Dependencies
```bash
npm ci
```
Install exact versions of dependencies from package-lock.json for consistent builds.

## Architecture Overview

This is a TypeScript library for automating YouTube video uploads, updates, and comments using Puppeteer with stealth plugins.

### Core Structure
- **Main Export**: `src/index.ts` exports all functionality from `src/upload.ts`
- **API Functions**: 
  - `upload()` - Upload videos to YouTube
  - `update()` - Update video metadata
  - `comment()` - Add comments to videos
- **Type Definitions**: `src/types.ts` contains all TypeScript interfaces
- **Browser Automation**: Uses Puppeteer with puppeteer-extra-plugin-stealth to avoid detection

### Key Interfaces
- `Video` - Configuration for video uploads (path, title, description, tags, thumbnail, etc.)
- `VideoToEdit` - Configuration for updating existing videos
- `VideoToComment` - Configuration for adding comments
- `MessageTransport` - Logging and user interaction callbacks

### Dependencies
- **puppeteer**: Browser automation
- **puppeteer-extra**: Enhanced Puppeteer functionality
- **puppeteer-extra-plugin-stealth**: Stealth mode to avoid bot detection
- **prettier**: Code formatting (dev dependency)
- **typescript**: TypeScript compiler (dev dependency)

### Build Configuration
- TypeScript target: ES2017
- Module system: CommonJS
- Output directory: `dist/`
- Strict mode enabled
- Source maps and declarations generated