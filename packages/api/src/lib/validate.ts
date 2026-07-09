import type { z } from 'zod'

/**
 * A 400 error carrying the flattened zod issues. Fastify's default error
 * handler serialises `statusCode` + `message`; we attach `issues` too so the
 * dashboard can highlight the offending fields.
 */
export class ValidationError extends Error {
  statusCode = 400
  issues: z.typeToFlattenedError<unknown>

  constructor(issues: z.typeToFlattenedError<unknown>) {
    super('Validation failed')
    this.name = 'ValidationError'
    this.issues = issues
  }
}

/** Run a zod schema, returning the parsed value or throwing a 400. */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new ValidationError(result.error.flatten())
  }
  return result.data
}
