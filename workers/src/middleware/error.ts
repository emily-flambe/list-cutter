export class ApiError extends Error {
  public statusCode: number;
  public details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function errorHandler(error: unknown): Response {
  console.error('Error:', error);
  
  if (error instanceof ApiError) {
    return new Response(JSON.stringify({
      error: error.message,
      details: error.details
    }), {
      status: error.statusCode,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (error instanceof Error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    error: 'Internal server error'
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
}