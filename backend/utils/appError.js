export class AppError extends Error {
  constructor(
    message,
    {
      status = 500,
      code = 'SERVER_ERROR',
      isOperational = true,
      details = null
    } = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
  }
}

export const createAppError = (message, options = {}) =>
  new AppError(message, options);

