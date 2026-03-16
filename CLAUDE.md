# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup          # First-time setup: install deps, generate Prisma client, run migrations
npm run dev            # Start dev server with Turbopack
npm run build          # Production build
npm run lint           # ESLint
npm run test           # Run Vitest tests
npm run db:reset       # Reset SQLite database
```

Run a single test file:
```bash
npx vitest run src/path/to/file.test.ts
```

## Architecture Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in chat; Claude generates code that populates a virtual file system, which is then compiled with Babel and rendered in a sandboxed iframe.

### Key Data Flow

1. User message → `/api/chat` (Next.js route handler)
2. Vercel AI SDK streams response from Claude (`claude-haiku-4-5`)
3. Claude calls tools (`str_replace_editor`, `file_manager`) to modify files
4. Tool results update the **in-memory virtual file system** (`FileSystemContext`)
5. Changed files trigger JSX transformation (Babel standalone) + import map generation
6. Preview iframe re-renders from blob URL

### Virtual File System

`src/lib/file-system.ts` — `VirtualFileSystem` class is the central data structure. Files are stored in `Map<string, FileNode>` with no disk writes. It serializes to/from JSON for database persistence.

Two React contexts wrap it:
- `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`) — exposes file CRUD operations
- `ChatContext` (`src/lib/contexts/chat-context.tsx`) — wraps Vercel AI SDK's `useChat` hook

### AI / Tools

- **Provider**: `src/lib/provider.ts` — `getLanguageModel()` returns real Anthropic model or `MockLanguageModel` when `ANTHROPIC_API_KEY` is unset
- **Tools**: `src/lib/tools/` — `str_replace_editor` (create/view/modify files) and `file_manager` (rename/delete)
- **System prompt**: `src/lib/prompts/generation.tsx`

### Preview Rendering

`src/components/preview/PreviewFrame.tsx` + `src/lib/transform/jsx-transformer.ts`:
- Babel standalone transforms JSX → JS in-browser
- Import map resolves bare specifiers (React, etc.) to esm.sh CDN URLs
- Output injected into iframe via blob URL

### Authentication

JWT cookies (7-day), bcrypt passwords, server-only utilities in `src/lib/auth.ts`. `src/middleware.ts` protects routes. Server actions in `src/actions/` handle auth and project CRUD.

### Database

Prisma + SQLite (`dev.db`). Two models: `User` and `Project`. Project messages and file system state stored as JSON strings.

## Environment

`ANTHROPIC_API_KEY` in `.env` — if empty, a mock provider returns static demo components. The app is fully functional without a key for development.

## UI Stack

- Tailwind CSS v4 (config via `postcss.config.mjs`, no `tailwind.config`)
- shadcn/ui components (style: "new-york") with Radix UI primitives
- Monaco Editor for code editing
- `react-resizable-panels` for the split-pane layout
