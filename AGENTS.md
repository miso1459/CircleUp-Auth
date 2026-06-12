# Project Context: SvelteKit Web Application

## 항상 무조건 한글로 답변

## 명확하지 않은 요청 처리 규칙

- 요청이 모호하거나 변경 범위가 불분명한 경우, 편집을 시작하기 전에 반드시 간결한 확인 질문을 먼저 한다.
- 사소한 변경(타이핑 수정, 변수명 변경 등)은 즉시 처리해도 된다.
- 복잡하거나 영향 범위가 큰 작업은 구현 전에 반드시 핵심 사항을 먼저 확인한다.
- 질문은 열린 질문보다 a/b/c 선택형이나 yes/no 형태로 한다.
- 사용자가 "그냥 해줘"라고 하면, 가정한 사항들을 번호 목록으로 제시하고 승인을 받은 뒤 진행한다.
- 명확하게 지시하지 않은 변경은 반드시 승인 후에 처리

## 작업이 완료되면 커밋 메시지 작성해서 커밋

## 작업이 완료되면 어떤 요청이였는지 간략히 정리

## caveman

Terse like caveman. Technical substance exact. Only fluff die.
Drop: articles, filler (just/really/basically), pleasantries, hedging.
Fragments OK. Short synonyms. Code unchanged.
Pattern: [thing] [action] [reason]. [next step].

ACTIVE EVERY RESPONSE. No revert.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.
When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.
Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Tech Stack

- Framework: SvelteKit (Version 2+)
- Component Framework: Svelte 5 (Using Runes)
- Language: TypeScript
- Package Manager: pnpm

## Core Development Rules (Crucial)

### 1. Svelte 5 Runes Only

- Do NOT use `export let prop`. Always use `const { prop1, prop2 } = $props();`.
- Do NOT use `let count = 0` for reactive variables. Always use `let count = $state(0);`.
- Use `$derived()` instead of `$: values = ...`.
- Use `$effect()` instead of `$: { ... }` side effects.

### 2. SvelteKit Directory-Based Routing

- Every route must be placed under `src/routes/`.
- Server-side data fetching MUST happen in `+page.server.ts` using the `load` function.
- UI rendering MUST happen in `+page.svelte`.
- Type definitions for data should leverage generated `./$types`.

### 3. State & Data Flow

- Page data from server load functions must be received in `+page.svelte` via:
  ```ts
  const { data } = $props();
  ```

## Current Goals

- [ ] Implement user authentication layout
- [ ] Connect database to `+page.server.ts`

# Global Technology & UI System Constraints

## Core Framework

- The default development environment for all projects is **Svelte / SvelteKit**.
- Never assume or generate React, Next.js, or Vue-based code unless explicitly requested by the user.

## UI Component Library (MANDATORY)

- You must exclusively use **shadcn-svelte** (https://shadcn-svelte.com) for all UI components and design systems.
- **Strict Prohibition:** Never reference, import, or generate code based on the React version of shadcn/ui.

## Coding & Import Standards

- Always use SvelteKit standard path aliases for UI components. Component imports must follow this structure:
  `import { ComponentName } from "$lib/components/ui/component-name";`
- Ensure all component state management and reactivity follow Svelte-native syntax (e.g., Svelte 5 Runes or Svelte 4 stores, depending on the project context).
- Use `lucide-svelte` as the primary icon library when icons are required.

## CLI Execution Rules

- When asked to add or install new UI components, always propose or execute the Svelte-specific CLI command:
  `npx shadcn-svelte@latest add [component-name]`
- Never use `npx shadcn@latest add` or `npx shadcn-ui@latest add`.

# DESIGN.md 파일 필수 참조
