# Prophet — Agent Skill Guide

Prophet is a real-time application platform. You can use the `prophet` CLI to create apps, define data schemas, deploy backends, query and mutate data, and subscribe to live updates — all from your terminal. If you want to give humans (or yourself) a richer experience, you can build and deploy a React UI alongside your app.

This guide teaches you everything you need to operate Prophet autonomously.

**Related guides:**
- [Prophet Codegen Skill Guide](https://preview.prophet.do/generate/skill.md) — DSL syntax, React client SDK hooks, UI components, and agent-friendly app requirements
- [Prophet Deploy Skill Guide](https://preview.prophet.do/deploy/skill.md) — Deploying, promoting, data migration, and troubleshooting

---

## 1. Install the Prophet CLI

The Prophet CLI is distributed as a platform-specific binary. Run the install script for your OS and architecture:

```bash
# macOS / Linux
curl -fsSL https://prophet.do/install.sh | sh

# Windows (PowerShell)
irm https://prophet.do/install.ps1 | iex
```

Or install manually (download, extract, and move to PATH):

```bash
# macOS (Apple Silicon)
curl -fsSL -L https://github.com/prophetdo/cli/releases/latest/download/prophet-darwin-arm64.tar.gz | tar xz
mv prophet /usr/local/bin/prophet

# macOS (Intel)
curl -fsSL -L https://github.com/prophetdo/cli/releases/latest/download/prophet-darwin-x64.tar.gz | tar xz
mv prophet /usr/local/bin/prophet

# Linux (x86_64)
curl -fsSL -L https://github.com/prophetdo/cli/releases/latest/download/prophet-linux-x64.tar.gz | tar xz
mv prophet /usr/local/bin/prophet

# Linux (ARM64)
curl -fsSL -L https://github.com/prophetdo/cli/releases/latest/download/prophet-linux-arm64.tar.gz | tar xz
mv prophet /usr/local/bin/prophet

# Windows (PowerShell)
Invoke-WebRequest -Uri https://github.com/prophetdo/cli/releases/latest/download/prophet-windows-x64.tar.gz -OutFile prophet.tar.gz
tar xzf prophet.tar.gz
Move-Item prophet.exe "$env:LOCALAPPDATA\prophet\prophet.exe" -Force
```

Verify installation:

```bash
prophet help
```

---

## 2. Authentication

Set the platform URL and authenticate:

```bash
export PROPHET_API_URL=https://beta.prophet.do

# Authenticate via browser (opens a login flow)
prophet login

# Verify your identity
prophet whoami
```

The CLI stores your auth token locally after login. All subsequent commands use it automatically.

---

## 3. Core Concepts

| Concept | What It Is |
|---------|-----------|
| **App** | A named project with a backend schema and optional UI |
| **Revision** | A versioned deployment of an app's schema + assets |
| **Entity** | A data model (like a database table) |
| **Mutation** | A named operation that creates, updates, or deletes entities |
| **Batch mutation** | An atomic group of mutations that all succeed or all roll back |
| **Shape** | A live query — subscribe to get real-time updates |
| **Scope** | Access control — who can see or modify an entity |
| **Members** | Users who have specific scopes on an entity |
| **Presence** | Ephemeral real-time state (cursors, typing indicators) |

---

## 4. App Management

### List your apps

```bash
prophet apps
```

### Create a new app

```bash
prophet apps create my-app --name "My Application"
```

### View app revisions

```bash
prophet revisions my-app
```

---

## 5. Defining a Backend (The .prophet File)

Create a `.prophet` file to define your app's data schema. This is a JavaScript DSL:

```javascript
import {
  api, mutation, entity, shape, members, presence,
  authenticatedUsers, currentUser, t,
} from "@/prophet";

// Define an entity (data model)
export const Task = entity({
  description: "A task",
  schema: {
    title: t.string(),
    completed: t.bool().default(false),
    priority: t.enum("low", "medium", "high").default("medium"),
    createdBy: t.user().default(currentUser),
  },
  scopes: ["owner", "viewer"],
});

// Define mutations (write operations)
export const createTask = mutation({
  args: { title: t.string(), priority: t.enum("low", "medium", "high") },
  returns: t.entity(Task),
  handler: (args) => {
    const task = Task.insert(args);
    task.grant(currentUser, "owner");
    task.grant(authenticatedUsers, "viewer");
    return task;
  },
  auth: () => authenticatedUsers,
});

export const updateTask = mutation({
  args: {
    task: t.entity(Task),
    title: t.string(),
    completed: t.bool(),
    priority: t.enum("low", "medium", "high"),
  },
  handler: ({ task, ...args }) => {
    task.update(args);
  },
  auth: ({ task }) => task.check("owner"),
});

export const deleteTask = mutation({
  args: { task: t.entity(Task) },
  handler: ({ task }) => {
    task.remove();
  },
  auth: ({ task }) => task.check("owner"),
});

// Define shapes (live queries)
export const AllTasks = shape({
  description: "All visible tasks",
  entity: Task,
  scope: Task.scope("viewer"),
  orderBy: Task.createdAt,
});

export const MyTasks = shape({
  description: "Tasks I own",
  entity: Task,
  scope: Task.scope("owner"),
  orderBy: Task.createdAt,
});

// Export the API (required at end of every .prophet file)
export default api();
```

### Field Types

| Type | Syntax |
|------|--------|
| String | `t.string()` |
| Number | `t.number()` |
| Boolean | `t.bool()` |
| Date | `t.date()` |
| Enum | `t.enum("a", "b", "c")` |
| User ref | `t.user()` |
| File ref | `t.file()` |
| Entity ref | `t.entity(OtherEntity)` |
| Parent ref | `t.partOf(Parent)` (cascade deletes) |
| JSON | `t.json()` |
| Array | `t.array(t.string())` |
| Object | `t.object({ name: t.string() })` |

Modifiers: `.optional()`, `.default(value)`, `.unique()`

### Entities with scopes (access control)

```javascript
export const Post = entity({
  description: "A blog post",
  schema: {
    title: t.string(),
    content: t.string(),
    published: t.bool().default(false),
    createdBy: t.user().default(currentUser),
  },
  scopes: ["author", "reader"],
});
```

### Shapes with filters

```javascript
// Filtered by field value
export const ActiveTasks = shape({
  entity: Task,
  where: (task) => !task.archived && !task.completed,
  scope: Task.scope("owner"),
});

// Filtered by enum value
export const HighPriority = shape({
  entity: Task,
  where: (task) => task.priority === "high",
  scope: Task.scope("owner"),
});

// Parameterized shape (takes args)
export const PostComments = shape({
  args: { post: t.entity(Post) },
  entity: Comment,
  where: (comment, args) => comment.post === args.post,
  scope: Comment.post.scope("reader"),
});
```

### Partitioned apps (multi-tenant)

```javascript
// Use partition for apps with a natural top-level grouping
export default api({ partition: Workspace });
```

---

## 6. Validate, Deploy, and Promote

### Validate your schema

```bash
prophet check tasks.prophet              # Validate without deploying
prophet check tasks.prophet --manifest   # Print the full manifest JSON
```

### Generate TypeScript types

```bash
prophet typegen tasks.prophet                    # Generate .ts next to source
prophet typegen tasks.prophet src/generated.ts   # Generate to explicit path
```

### Deploy

```bash
# Deploy schema only
prophet deploy tasks.prophet --app my-app -m "initial schema"

# Deploy schema + UI assets
prophet deploy tasks.prophet --app my-app --assets ./dist -m "with UI"

# Deploy and copy data from a previous revision
prophet deploy tasks.prophet --app my-app --copy-from 3 --assets ./dist -m "updated schema"
```

If `--app` is omitted, the slug is derived from the filename (e.g., `tasks.prophet` → `tasks`).

### Make a revision live

```bash
prophet promote my-app 5    # Make revision 5 the live revision
```

**Important:** `prophet deploy` creates a new revision but does NOT make it live. Always `promote` after deploying.

---

## 7. Querying Data

### Query a shape (one-shot)

```bash
# Query a shape with no args
prophet query my-app AllTasks

# Query a shape with args
prophet query my-app TasksByProject '{"project":"proj_abc123"}'

# Query a specific revision
prophet query my-app AllTasks --revision 3
```

### Run a mutation

```bash
prophet mutate my-app createTask '{"title":"Ship feature","priority":"high"}'

# The returned value (e.g., entity ID) is printed to stdout
```

### Run a batch mutation

```bash
prophet batch-mutate my-app '[{"name":"createTask","args":{"title":"Task A","priority":"high"}},{"name":"createTask","args":{"title":"Task B","priority":"low"}}]'
```

Use batch mutation for bulk import, bulk delete, reorder operations, or any multi-step write that must be atomic. If any mutation in the batch fails, none of them are committed.

### Inspect a deployed manifest

```bash
prophet manifest my-app                  # Current live revision
prophet manifest my-app --revision 3     # Specific revision
```

### List deployed assets

```bash
prophet assets my-app
prophet assets my-app --revision 3
```

---

## 8. Real-Time Subscriptions (WebSocket REPL)

Connect to an app's WebSocket for live data:

```bash
prophet connect my-app
```

Inside the REPL:

```
# Subscribe to a shape
subscribe AllTasks

# Subscribe with args
subscribe TasksByProject {"project":"proj_abc123"}

# List active subscriptions
subscriptions

# Unsubscribe
unsubscribe <sub_id>

# Watch members on an entity
members TaskMembers <entity_id>

# Track presence
presence TaskPresence <entity_id> {"viewing":true}

# Publish presence update
publish <sub_id> {"viewing":false}
```

Connect to a specific revision:

```bash
prophet connect my-app --revision 3
```

---

## 9. File Management

Upload, download, and manage files:

```bash
# List all uploaded files
prophet files

# Upload a file
prophet files upload ./screenshot.png --content-type image/png

# Download a file by ID
prophet files download file_abc123 --output ./downloaded.png

# Delete a file
prophet files delete file_abc123
```

Files are referenced in entities via `t.file()` fields. Upload returns a `FileId` that you pass to mutations.

---

## 10. Building a UI (Optional)

If you want to give your app a visual interface, build a React app that uses the Prophet client SDK. For the full DSL reference, React hook APIs, UI component catalog, and agent-friendly app requirements, see the [Prophet Codegen Skill Guide](https://preview.prophet.do/generate/skill.md).

### Project structure

```
my-app/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── my-app.prophet          # Backend schema
├── my-app.ts               # Generated types (prophet typegen)
└── src/
    ├── index.css           # Tailwind + theme
    ├── main.tsx            # Entry: <ProphetApp><App /></ProphetApp>
    ├── App.tsx             # Routes and views
    └── components/ui/      # shadcn/ui components
```

### Entry point

```tsx
import { ProphetApp } from "@prophet/client/react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <ProphetApp>
    <App />
  </ProphetApp>
);
```

### Key React hooks

```tsx
import {
  useSubscribe, useMutation, useBatchMutation, useMembers, usePresence,
  useUser, useUsers, useCurrentUser, useUploadFile, useFile,
  Switch, Route, Link, useLocation, useParams,
} from "@prophet/client/react";

// Subscribe to real-time data
const { data, loading, error } = useSubscribe(AllTasks);
const tasks = data ?? [];

// Subscribe with args — wrap in { args: { ... } }
const { data } = useSubscribe(TasksByProject, { args: { project: projectId } });

// Run a mutation — destructure { mutate }, NOT the return value
const { mutate: doCreate } = useMutation(createTask);
await doCreate({ title: "New task", priority: "high" });

// Run an atomic batch of mutations
const { batchMutate } = useBatchMutation();
await batchMutate([
  { mutation: createTask, args: { title: "Task A", priority: "high" } },
  { mutation: createTask, args: { title: "Task B", priority: "low" } },
]);

// Members — returns Record<scope, string[]>, NOT an array of objects
const { data } = useMembers(TaskMembers, { entity: taskId });
const owners = data?.owner ?? [];

// Presence — track ephemeral state
const { data: peers, publish } = usePresence(TaskPresence, {
  entity: taskId,
  initialData: { viewing: true },
});

// Current user
const { user: currentUser } = useCurrentUser();

// File upload (two-step: upload → FileId → pass to mutation)
const { upload } = useUploadFile();
const fileId = await upload(selectedFile);
await doCreatePhoto({ image: fileId });

// Resolve file URL for rendering
const { file: fileData } = useFile(photo.image);
// Use fileData?.downloadUrl in <img src=...>
```

### Routing (within Prophet apps)

Prophet apps use their own routing that syncs across the iframe boundary:

```tsx
import { Switch, Route, Link, useLocation, useParams } from "@prophet/client/react";

function App() {
  return (
    <Switch>
      <Route path="/"><TaskList /></Route>
      <Route path="/:id"><TaskDetail /></Route>
    </Switch>
  );
}

// CRITICAL: Do NOT prefix routes with the app name.
// The host URL already includes it (e.g., /app/tasks/...).
// Use /:id, not /tasks/:id
```

### Build and deploy with UI

```bash
bun install
bun run build
prophet deploy my-app.prophet --app my-app --assets ./dist -m "v1 with UI"
prophet promote my-app <revision>
```

---

## 11. Platform URL Patterns

All platform endpoints accept an optional `?revision=N` query parameter:

```
GET  /apps/:org/:slug/assets/<path>    # Serve static assets
POST /apps/:org/:slug                  # Call app operations
WS   /apps/:org/:slug/ws              # WebSocket connection
```

### Non-React usage (programmatic client)

```javascript
import { ProphetClient } from "@prophet/client";

const client = new ProphetClient({
  baseUrl: "https://beta.prophet.do",
  orgSlug: "my-org",
  appName: "my-app",
  token: "jwt-token",
});

// Query a shape
const tasks = await client.query(AllTasks);

// Query with args
const projectTasks = await client.query(TasksByProject, {
  args: { project: id },
});

// Run a mutation
const newId = await client.mutate(createTask, {
  args: { title: "...", priority: "high" },
});

// Run multiple mutations atomically
const results = await client.batchMutate([
  { name: "createTask", args: { title: "Task A", priority: "high" } },
  { name: "createTask", args: { title: "Task B", priority: "low" } },
]);
```

---

## 12. Common Workflows

### Create an app from scratch

```bash
# 1. Create the app
prophet apps create todo --name "Todo App"

# 2. Write the .prophet schema file (see Section 5)

# 3. Validate
prophet check todo.prophet

# 4. Generate types
prophet typegen todo.prophet

# 5. Deploy
prophet deploy todo.prophet --app todo -m "initial deploy"

# 6. Promote to make it live
prophet revisions todo    # find the revision number
prophet promote todo 1

# 7. Query your data
prophet query todo AllTasks

# 8. Create some data
prophet mutate todo createTask '{"title":"Hello world","priority":"medium"}'
```

### Seed data into an existing app

```bash
# Create entities via mutations
prophet mutate my-app createProject '{"key":"PLAT","name":"Platform","color":"#2563eb"}'
# Use the returned ID for child entities
prophet mutate my-app createTicket '{"project":"<project-id>","title":"Fix auth","priority":"high","type":"bug"}'
```

### Migrate data between revisions

```bash
# 1. Query all data from current live revision
prophet query my-app AllProjects --revision 3

# 2. Deploy new schema
prophet deploy updated.prophet --app my-app -m "schema update"

# 3. Promote new revision
prophet promote my-app 4

# 4. Replay data via mutations
prophet mutate my-app createProject '{"key":"PLAT","name":"Platform"}'
```

### Debug a deployed app

```bash
# Inspect the manifest
prophet manifest my-app

# List assets
prophet assets my-app

# Connect to WebSocket and watch live data
prophet connect my-app
```

---

## 13. Tips for Agents

- **Always `promote` after `deploy`.** Deploy creates a revision but doesn't make it live.
- **Use `--copy-from` when updating schemas** to preserve existing data. Fall back to manual migration if it fails.
- **Mutation arg names starting with `_` are rejected** by the platform (reserved prefix).
- **Use batch mutation for bulk or all-or-nothing writes.** Prefer `prophet batch-mutate`, `useBatchMutation`, or `client.batchMutate` over many sequential writes when partial success would be a bug.
- **Build before deploying with `--assets`.** The flag uploads whatever is in the directory at that moment.
- **Query with `--revision N`** to inspect data from any revision, even old ones.
- **Transient deploy failures happen.** Simply retry the same command.
- **The `prophet connect` REPL** is your best tool for debugging real-time behavior.
- **File upload is two-step:** upload to get a FileId, then pass it to a mutation that stores it.
- **Every `.prophet` file must end with `export default api()`** or `export default api({ partition: Entity })`.
- **Don't declare `id`, `createdAt`, or `updatedAt` fields** — they're auto-generated.
- **After `Entity.insert()`, grant a scope** or the creator can't see the entity.

---

## Quick Reference

```bash
# Auth
prophet login
prophet whoami

# Apps
prophet apps
prophet apps create <slug> --name "..."

# Schema
prophet check <file.prophet>
prophet check <file.prophet> --manifest
prophet typegen <file.prophet>

# Deploy
prophet deploy <file.prophet> --app <slug> -m "msg"
prophet deploy <file.prophet> --app <slug> --assets ./dist -m "msg"
prophet deploy <file.prophet> --app <slug> --copy-from <rev> -m "msg"
prophet promote <slug> <revision>
prophet revisions <slug>

# Data
prophet query <app> <ShapeName> ['{"arg":"val"}']
prophet mutate <app> <MutationName> '{"arg":"val"}'
prophet batch-mutate <app> '[{"name":"mutation","args":{...}}, ...]'
prophet manifest <app> [--revision N]
prophet assets <app> [--revision N]

# Files
prophet files
prophet files upload <path> [--content-type <type>]
prophet files download <id> [--output <path>]
prophet files delete <id>

# Real-time
prophet connect <app> [--revision N]
```

---

*Prophet — the real-time application platform. Learn more at [prophet.do](https://prophet.do)*
