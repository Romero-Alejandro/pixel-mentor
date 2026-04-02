export function handlePrismaError(
  error: unknown,
  ErrorClass: new (id: string) => Error,
  id: string,
): never {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const prismaError = error as { code: unknown };
    if (prismaError.code === 'P2025') {
      throw new ErrorClass(id);
    }
  }

  throw error instanceof Error ? error : new Error(String(error));
}
