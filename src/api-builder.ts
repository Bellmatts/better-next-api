import * as z from "zod";
import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "./api-error";

// --- Type Helpers ---

/**
 * This now accepts objects, pipes (from .transform/z.preprocess),
 * and standalone transforms (from z.transform).
 */
type ZodSchema =
  | z.ZodObject<any>
  | z.ZodPipe<any, any>
  | z.ZodTransform<any, any>;

/**
 * Infers the TypeScript type from a Zod schema, or returns `undefined` if no schema.
 */
type InferSchema<T> = T extends ZodSchema ? z.infer<T> : undefined;

/**
 * The callback function for the .failed() method.
 */
type FailureHandler = (input: {
  req: NextRequest;
  error: unknown;
}) => Promise<void>;

/**
 * The fully-typed input object that middleware and handlers receive.
 */
export type HandlerInput<
  TContextSchema extends ZodSchema | undefined,
  TQuerySchema extends ZodSchema | undefined,
  TBodySchema extends ZodSchema | undefined,
  TContext extends Record<string, unknown>
> = {
  /**
   * Validated route parameters (from /api/posts/[id]).
   * `undefined` if `.context()` was not used.
   */
  context: InferSchema<TContextSchema>;
  /**
   * Validated search parameters (from /api/posts?include=true).
   * `undefined` if `.query()` was not used.
   */
  query: InferSchema<TQuerySchema>;
  /**
   * Validated JSON request body.
   * `undefined` if `.body()` was not used or if method is not POST/PUT/PATCH.
   */
  body: InferSchema<TBodySchema>;
  /**
   * The cumulative context from all chained middleware.
   */
  ctx: TContext;
  /**
   * The raw Next.js Request object.
   */
  req: NextRequest;
};

/**
 * @description Checks if an error is an internal Next.js error (e.g., redirect, notFound).
 * These errors should be re-thrown to be handled by the Next.js framework.
 * @param {unknown} error - The error to check.
 * @returns {boolean} - True if the error is a Next.js internal error, false otherwise.
 */
function isNextJsInternalError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }

  const digest = (error as { digest?: string }).digest;

  // Checks for NEXT_REDIRECT, NEXT_NOT_FOUND, etc.
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

// --- Main Class ---

export class ApiBuilder<
  TContextSchema extends ZodSchema | undefined,
  TQuerySchema extends ZodSchema | undefined,
  TBodySchema extends ZodSchema | undefined,
  TContext extends Record<string, unknown>
> {
  // Store the schemas, middleware chain, and failure handler
  private contextSchema: TContextSchema;
  private querySchema: TQuerySchema;
  private bodySchema: TBodySchema;
  private middlewares: ((
    input: HandlerInput<any, any, any, any>
  ) => Promise<Record<string, unknown>>)[];
  private failureHandler: FailureHandler | undefined;

  constructor(config: {
    contextSchema: TContextSchema;
    querySchema: TQuerySchema;
    bodySchema: TBodySchema;
    middlewares: any[];
    failureHandler: FailureHandler | undefined;
  }) {
    this.contextSchema = config.contextSchema;
    this.querySchema = config.querySchema;
    this.bodySchema = config.bodySchema;
    this.middlewares = config.middlewares;
    this.failureHandler = config.failureHandler;
  }

  /**
   * Adds Zod validation for route parameters (e.g., `[id]`).
   */
  public context<S extends ZodSchema>(
    schema: S
  ): ApiBuilder<S, TQuerySchema, TBodySchema, TContext> {
    return new ApiBuilder({ ...this, contextSchema: schema });
  }

  /**
   * Adds Zod validation for URL search parameters (e.g., `?include=true`).
   */
  public query<S extends ZodSchema>(
    schema: S
  ): ApiBuilder<TContextSchema, S, TBodySchema, TContext> {
    return new ApiBuilder({ ...this, querySchema: schema });
  }

  /**
   * Adds Zod validation for the JSON request body.
   */
  public body<S extends ZodSchema>(
    schema: S
  ): ApiBuilder<TContextSchema, TQuerySchema, S, TContext> {
    return new ApiBuilder({ ...this, bodySchema: schema });
  }

  /**
   * Adds a middleware function to the chain.
   * Middleware runs *after* validation and in sequence.
   */
  public use<TNewContext extends Record<string, unknown>>(
    middleware: (
      input: HandlerInput<TContextSchema, TQuerySchema, TBodySchema, TContext>
    ) => Promise<TNewContext>
  ): ApiBuilder<
    TContextSchema,
    TQuerySchema,
    TBodySchema,
    TContext & TNewContext
  > {
    return new ApiBuilder({
      ...this,
      middlewares: [...this.middlewares, middleware],
    });
  }

  /**
   * Adds an unhandled error handler for logging.
   * This runs ONLY for unexpected errors, not ApiErrors.
   */
  public failed(
    handler: FailureHandler
  ): ApiBuilder<TContextSchema, TQuerySchema, TBodySchema, TContext> {
    return new ApiBuilder({ ...this, failureHandler: handler });
  }

  // --- HTTP Method Handlers ---

  /**
   * Creates a GET route handler.
   */
  public get(
    handler: (
      input: HandlerInput<TContextSchema, TQuerySchema, TBodySchema, TContext>
    ) => Promise<any>
  ) {
    return this.createRouteHandler("GET", handler);
  }

  /**
   * Creates a POST route handler.
   */
  public post(
    handler: (
      input: HandlerInput<TContextSchema, TQuerySchema, TBodySchema, TContext>
    ) => Promise<any>
  ) {
    return this.createRouteHandler("POST", handler);
  }

  /**
   * Creates a PUT route handler.
   */
  public put(
    handler: (
      input: HandlerInput<TContextSchema, TQuerySchema, TBodySchema, TContext>
    ) => Promise<any>
  ) {
    return this.createRouteHandler("PUT", handler);
  }

  /**
   * Creates a PATCH route handler.
   */
  public patch(
    handler: (
      input: HandlerInput<TContextSchema, TQuerySchema, TBodySchema, TContext>
    ) => Promise<any>
  ) {
    return this.createRouteHandler("PATCH", handler);
  }

  /**
   * Creates a DELETE route handler.
   */
  public delete(
    handler: (
      input: HandlerInput<TContextSchema, TQuerySchema, TBodySchema, TContext>
    ) => Promise<any>
  ) {
    return this.createRouteHandler("DELETE", handler);
  }

  // --- Private Handler Factory ---

  /**
   * The core logic that creates the Next.js route handler.
   */
  private createRouteHandler(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    handler: (
      input: HandlerInput<TContextSchema, TQuerySchema, TBodySchema, TContext>
    ) => Promise<any>
  ) {
    // This is the actual Next.js route handler
    return async (
      req: NextRequest,
      routeCtx: { params: Promise<unknown> }
    ): Promise<NextResponse> => {
      try {
        // --- 1. Validation ---
        const validatedContext = await this.validate(
          this.contextSchema,
          await routeCtx.params
        );
        const validatedQuery = await this.validate(
          this.querySchema,
          Object.fromEntries(req.nextUrl.searchParams.entries())
        );

        let validatedBody: any;
        if (["POST", "PUT", "PATCH"].includes(method)) {
          try {
            const json = await req.json();
            validatedBody = await this.validate(this.bodySchema, json);
          } catch (e: any) {
            if (this.bodySchema) {
              throw new ApiError({
                code: 400,
                type: "INVALID_BODY",
                message: "Invalid JSON body provided.",
              });
            }
          }
        }

        const inputBase = {
          context: validatedContext,
          query: validatedQuery,
          body: validatedBody,
          req,
        };

        // --- 2. Middleware ---
        let cumulativeCtx: TContext = {} as TContext;
        for (const middleware of this.middlewares) {
          const newCtx = await middleware({ ...inputBase, ctx: cumulativeCtx });
          cumulativeCtx = { ...cumulativeCtx, ...newCtx };
        }

        // --- 3. Handler ---
        const result = await handler({ ...inputBase, ctx: cumulativeCtx });

        // If handler returns a NextResponse, pass it through.
        if (result instanceof NextResponse) {
          return result;
        }

        // --- 5. Success Response ---
        const status = method === "POST" ? 201 : 200;
        return NextResponse.json(result, { status });
      } catch (error: unknown) {
        // --- 6. Error Handling ---
        if (isNextJsInternalError(error)) {
          throw error;
        }

        if (error instanceof ApiError) {
          return NextResponse.json(
            { message: error.message, type: error.type, issues: error.issues },
            { status: error.code }
          );
        }

        // Unhandled Error Logging
        if (this.failureHandler) {
          try {
            await this.failureHandler({ req, error });
          } catch (loggingError) {
            console.error("Error within .failed() handler:", loggingError);
          }
        }

        // Fallback for all unexpected errors
        console.error("Unhandled API error:", error);
        return NextResponse.json(
          {
            message: "An internal server error occurred.",
            type: "INTERNAL_SERVER_ERROR",
          },
          { status: 500 }
        );
      }
    };
  }

  /**
   * Private validation helper.
   */
  private async validate(schema: ZodSchema | undefined, data: unknown) {
    if (!schema) {
      return data === undefined ? undefined : data;
    }
    const result = await schema.safeParseAsync(data);
    if (!result.success) {
      throw new ApiError({
        code: 400,
        type: "VALIDATION_ERROR",
        message: "Invalid input.",
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}

/**
 * Creates a new, unauthenticated API handler builder.
 */
export const createApiHandler = () => {
  return new ApiBuilder({
    contextSchema: undefined,
    querySchema: undefined,
    bodySchema: undefined,
    middlewares: [],
    failureHandler: undefined,
  });
};
