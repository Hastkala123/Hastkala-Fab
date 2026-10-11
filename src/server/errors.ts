/**
 * An error whose message is written for the shopper or staff member and is
 * safe to show as-is. The API wrapper turns it into a response with `status`;
 * anything else that is thrown becomes a generic 500.
 */
export class UserError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "UserError";
  }
}

export class NotFoundError extends UserError {
  constructor(message = "Not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}
