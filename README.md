# better-next-api

[![npm version](https://img.shields.io/npm/v/better-next-api.svg?style=flat-square)](https://www.npmjs.com/package/better-next-api)
[![npm downloads](https://img.shields.io/npm/dm/better-next-api.svg?style=flat-square)](https://www.npmjs.com/package/better-next-api)

A typesafe and structured way to build Next.js App Router API handlers. Get a tRPC-like developer experience with Zod validation and composable middleware, without leaving your standard API routes.

## 🚀 Core Features

* **End-to-End Type Safety:** Automatically infer types for route params, search params, and request body.
* **Zod-First Validation:** Use Zod schemas to validate all inputs before your handler runs.
* **Composable Middleware:** Chain middleware functions to handle authentication, logging, or any other repeated logic.
* **Validation-First Architecture:** Middleware runs *after* validation, so your auth checks can safely access validated data (e.g., check if a user owns the resource from `context.id`).
* **Centralized Error Handling:** Throw a simple `ApiError` for expected failures and use `.failed()` to log all unexpected exceptions.
* **Full Next.js Control:** An "escape hatch" lets you return a full `NextResponse` at any time to set custom headers, cookies, or cache tags.

-----

## 1\. Installation

Install the package and its peer dependency, `zod`.

```bash
npm install better-next-api zod
```

```bash
yarn add better-next-api zod
```

```bash
pnpm add better-next-api zod
```

-----

## 2\. Setup (Getting Started)

The first step is to create your API "clients" (handlers) in a single file. This is where you'll define your base handlers and all your middleware.

Create a file at `/lib/api-handler.ts`:

```typescript
// /lib/api-handler.ts
import "server-only";
import { createApiHandler, ApiError, HandlerInput } from "better-next-api";
import * as z from "zod"; // Use namespace import for Zod

// --- 1. Define Middleware ---
// (This is just an example, replace with your real auth logic)

// Define your app's user type
type User = {
  id: string;
  name: string;
  isAdmin: boolean;
};

// Mock session function
const getSession = async (): Promise<{ user: User } | null> => {
  return {
    user: { id: "user_123", name: "Test User", isAdmin: true },
  };
};

/**
 * A middleware to check for an authenticated user.
 */
export const authMiddleware = async ()T> {
  const session = await getSession();
  if (!session?.user) {
    throw new ApiError({
      code: 401,
      type: "UNAUTHORIZED",
      message: "Not authenticated.",
    });
  }
  // This object is merged into the `ctx` for the next middleware or handler
  return {
    user: session.user,
  };
};

/**
 * A middleware to check for admin privileges.
 * This MUST run *after* authMiddleware.
 */
export const adminMiddleware = async (
  // The input is typesafe! It knows `user` is in the context.
  input: HandlerInput<any, any, any, { user: User }>
) => {
  if (!input.ctx.user.isAdmin) {
    throw new ApiError({
      code: 403,
      type: "FORBIDDEN",
      message: "You are not an admin.",
    });
  }
  // No new context to add, just pass the check
  return {};
};

// --- 2. Define Handlers ---

/**
 * A public API handler that anyone can access.
 */
export const publicApi = createApiHandler();

/**
 * A protected API handler that requires a user to be authenticated.
 */
export const protectedApi = publicApi.use(authMiddleware);

/**
 * An admin-only API handler.
 */
export const adminApi = protectedApi.use(adminMiddleware);
```

-----

## 3\. In-Depth Usage

Now you can import and use your handlers in any API route.

### Basic GET Route

The builder automatically wraps your return value in `NextResponse.json()` for you.

```typescript
// /app/api/hello/route.ts
import { publicApi } from "@/lib/api-handler";

export const GET = publicApi.get(async ({}) => {
  // `context`, `query`, `body`, and `ctx` are all available
  return { message: "Hello, world!" };
});

// Responds with:
// status: 200
// body: { "message": "Hello, world!" }
```

### Input Validation

Validate all parts of an incoming request by chaining validation methods.

* `.context(schema)`: Validates `params` from dynamic routes (e.g., `[id]`).
* `.query(schema)`: Validates `searchParams` (e.g., `?include=true`).
* `.body(schema)`: Validates the JSON body of a `POST` or `PATCH` request.

If validation fails, the builder automatically returns a 400 Bad Request response with the Zod issues.

```typescript
// /app/api/posts/[id]/route.ts
import { protectedApi } from "@/lib/api-handler";
import { ApiError } from "better-next-api";
import { db } from "@/lib/db";
import * as z from "zod";

// 1. Define schemas
const contextSchema = z.object({
  id: z.string().cuid(), // Validates `params.id`
});

const getQuerySchema = z.object({
  includeComments: z.coerce.boolean().optional(),
});

const patchBodySchema = z.object({
  title: z.string().min(3).optional(),
  content: z.string().min(10).optional(),
});

// 2. Use schemas in your handlers

// --- GET Handler ---
export const GET = protectedApi
  .context(contextSchema) // 1. Validate `params`
  .query(getQuerySchema) // 2. Validate `searchParams`
  .get(async ({ context, query, ctx }) => {
    // Everything is typesafe!
    // - context: { id: string }
    // - query: { includeComments?: boolean }
    // - ctx: { user: { id: string, ... } }

    const post = await db.post.findFirst({
      where: {
        id: context.id,
        authorId: ctx.user.id, // Enforce ownership
      },
      include: {
        comments: query.includeComments,
      },
    });

    if (!post) {
      throw new ApiError({ code: 404, message: "Post not found." });
    }

    return post;
  });

// --- PATCH Handler ---
export const PATCH = protectedApi
  .context(contextSchema) // 1. Validate `params`
  .body(patchBodySchema) // 2. Validate `request.json()`
  .patch(async ({ context, body, ctx }) => {
    // Typesafe!
    // - context: { id: string }
    // - body: { title?: string, content?: string }
    // - ctx: { user: { id: string, ... } }

    const updatedPost = await db.post.update({
      where: {
        id: context.id,
        authorId: ctx.user.id,
      },
      data: body,
    });

    return updatedPost;
  });
```

### Middleware & Validation-First Flow

A key feature is that **validation runs *before* middleware**. This allows you to write powerful authorization middleware that can safely access validated data.

For example, your middleware can check if a user is the owner of a post *before* the handler logic runs.

```typescript
// /lib/api-handler.ts

// ... (authMiddleware, publicApi, protectedApi as before) ...
import * as z from "zod";

// 1. Define a schema that your middleware will need
const postContextSchema = z.object({
  id: z.string().cuid(),
});

// 2. Define the ownership middleware
export const isPostOwnerMiddleware = async (
  // It receives the validated context!
  input: HandlerInput<
    typeof postContextSchema, // Typesafe: knows `context.id` is a CUID
    any,
    any,
    { user: User } // Typesafe: knows `user` is in ctx
  >
) => {
  const { context, ctx } = input;

  const post = await db.post.findUnique({
    where: { id: context.id },
    select: { authorId: true },
  });

  if (post?.authorId !== ctx.user.id) {
    throw new ApiError({ code: 403, message: "You do not own this resource." });
  }
  return {};
};

// 3. Create a new, specific handler
export const postOwnerApi = protectedApi.use(isPostOwnerMiddleware);
```

```typescript
// /app/api/posts/[id]/route.ts

// Use your new handler
import { postOwnerApi } from "@/lib/api-handler";

// ... (schemas) ...

// This PATCH handler will only run if:
// 1. `context.id` is a valid CUID
// 2. The user is authenticated (from `protectedApi`)
// 3. The user is the post owner (from `isPostOwnerMiddleware`)
export const PATCH = postOwnerApi
  .context(contextSchema)
  .body(patchBodySchema)
  .patch(async ({ context, body, ctx }) => {
    // By the time this code runs, we know the user is the owner.
    const updatedPost = await db.post.update({
      where: { id: context.id },
      data: body,
    });
    return updatedPost;
  });
```

### Error Handling

There are two types of errors.

#### 1\. Handled Errors (`ApiError`)

For expected errors (e.g., "Not Found," "Unauthorized"), **throw an `ApiError`**. The builder will catch it and send a formatted JSON response with the correct status code.

```typescript
// In your handler
if (!post) {
  throw new ApiError({
    code: 404,
    type: "NOT_FOUND",
    message: "Post not found.",
  });
}
```

Your client will receive a standardized error:

```json
// status: 404
{
  "message": "Post not found.",
  "type": "NOT_FOUND"
}
```

#### 2\. Unhandled Errors (`.failed()`)

For *unexpected* errors (e.g., a database crash, a 500 error), use the `.failed()` method on your base handler. This is the perfect place to log errors to a service like Sentry or LogSnag.

```typescript
// /lib/api-handler.ts
import { createApiHandler } from "better-next-api";
// import { Sentry } from "@sentry/nextjs";

/**
 * A global handler for logging all unexpected API errors.
 */
const globalFailureHandler = async ({
  req,
  error,
}: {
  req: NextRequest;
  error: unknown;
}) => {
  console.error("--- UNHANDLED API ERROR ---", error);
  // Sentry.captureException(error);
};

/**
 * A public API handler that includes global error logging.
 */
export const publicApi = createApiHandler()
  .failed(globalFailureHandler); // <-- Attach it here

// All other handlers that chain from publicApi will inherit it
export const protectedApi = publicApi.use(authMiddleware);
```

### Advanced: The "Escape Hatch"

If you need full control over the response to set custom headers, cookies, or cache tags, just **return a `NextResponse` object directly** from your handler. The builder will detect it and send it as-is.

```typescript
// /app/api/posts/route.ts
import { publicApi } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const GET = publicApi
  .get(async () => {
    const posts = await db.post.findMany({ take: 10 });

    // Return a full NextResponse to set cache headers
    return NextResponse.json(posts, {
      status: 200,
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate',
      }
    });
  });
```

-----

## 4\. API Reference

### Builder Methods

| Method | Description |
| :--- | :--- |
| **`.context(schema)`** | Adds a Zod schema to validate `params`. |
| **`.query(schema)`** | Adds a Zod schema to validate `searchParams`. |
| **`.body(schema)`** | Adds a Zod schema to validate `request.json()`. |
| **`.use(middleware)`** | Adds an async middleware function to the chain. |
| **`.failed(handler)`** | Adds an async callback to run on unhandled errors. |
| **`.get(handler)`** | Creates the final `GET` route handler. |
| **`.post(handler)`** | Creates the final `POST` route handler. |
| **`.put(handler)`** | Creates the final `PUT` route handler. |
| **`.patch(handler)`** | Creates the final `PATCH` route handler. |
| **`.delete(handler)`**| Creates the final `DELETE` route handler. |

### Handler Input

Your middleware and final handler functions receive a single, typesafe object with these properties:

* `context`: The validated route parameters.
* `query`: The validated search parameters.
* `body`: The validated JSON body.
* `ctx`: The cumulative context from all middleware (e.g., `{ user: ... }`).
* `req`: The raw `NextRequest` object.

## License

MIT
