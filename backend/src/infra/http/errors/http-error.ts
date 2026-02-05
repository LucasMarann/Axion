export class HttpError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status = 500, opts?: { code?: string; details?: unknown }) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = opts?.code;
    this.details = opts?.details;
  }
}