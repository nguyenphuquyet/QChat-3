export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export function requireCondition(
  value: unknown,
  status = 403,
  code = "FORBIDDEN",
): asserts value {
  if (!value) throw new ApiError(status, code);
}
