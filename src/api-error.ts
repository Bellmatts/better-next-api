import * as z from "zod";

export type ApiErrorProps = {
  /**
   * The HTTP status code.
   * @default 500
   */
  code?: number;
  /**
   * A short, machine-readable error code.
   * @example "UNAUTHORIZED"
   */
  type?: string;
  /**
   * The developer-facing error message.
   */
  message: string;
  /**
   * Optional Zod validation issues.
   */
  issues?: z.ZodIssue[];
};

/**
 * Custom error class for API routes.
 * Use this to trigger a specific, non-500 error response.
 *
 * @example
 * throw new ApiError({ code: 401, message: "Not authenticated." })
 *
 * @example
 * throw new ApiError({
 * code: 400,
 * message: "Validation error.",
 * issues: zodError.flatten().fieldErrors
 * })
 */
export class ApiError extends Error {
  public readonly code: number;
  public readonly type: string;
  public readonly issues: z.ZodIssue[] | undefined;

  constructor(props: ApiErrorProps) {
    super(props.message);
    this.name = "ApiError";
    this.code = props.code ?? 500;
    this.type = props.type ?? "INTERNAL_SERVER_ERROR";
    this.issues = props.issues;
  }
}
