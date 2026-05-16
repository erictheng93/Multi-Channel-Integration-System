// Custom error classes for the installer

export class InstallerError extends Error {
  public readonly statusCode: number;
  public readonly type: string;

  constructor(message: string, statusCode: number = 500, type: string = 'InstallerError') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.type = type;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends InstallerError {
  constructor(message: string) {
    super(message, 400, 'ValidationError');
  }
}

export class AuthenticationError extends InstallerError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AuthenticationError');
  }
}

export class NotFoundError extends InstallerError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NotFoundError');
  }
}

export class ResourceConflictError extends InstallerError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409, 'ResourceConflictError');
  }
}

export class QuotaExceededError extends InstallerError {
  constructor(message: string = 'Quota exceeded') {
    super(message, 429, 'QuotaExceededError');
  }
}

export class CloudflareAPIError extends InstallerError {
  constructor(message: string, statusCode: number = 500) {
    super(message, statusCode, 'CloudflareAPIError');
  }
}

interface CloudflareErrorLike {
  message?: string;
  statusCode?: number;
}

function isCloudflareErrorLike(error: unknown): error is CloudflareErrorLike {
  return typeof error === 'object' && error !== null;
}

export function mapCloudflareError(error: unknown): InstallerError {
  const errorLike = isCloudflareErrorLike(error) ? error : {};
  const message = typeof errorLike.message === 'string'
    ? errorLike.message
    : 'Unknown Cloudflare API error';
  const statusCode = typeof errorLike.statusCode === 'number'
    ? errorLike.statusCode
    : 500;

  if (statusCode === 401 || statusCode === 403) {
    return new AuthenticationError('Insufficient permissions or invalid credentials');
  }

  if (statusCode === 404) {
    return new NotFoundError('Cloudflare resource not found');
  }

  if (statusCode === 409) {
    return new ResourceConflictError('Resource with this name already exists');
  }

  if (statusCode === 429) {
    return new QuotaExceededError('Cloudflare API rate limit exceeded');
  }

  return new CloudflareAPIError(message, statusCode);
}
