export type SignUpErrorKey = "emailRateLimit" | "failed";

function errorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { code: "", message: "", status: undefined };
  }

  const value = error as {
    code?: unknown;
    message?: unknown;
    status?: unknown;
  };

  return {
    code: typeof value.code === "string" ? value.code.toLowerCase() : "",
    message:
      typeof value.message === "string" ? value.message.toLowerCase() : "",
    status: typeof value.status === "number" ? value.status : undefined,
  };
}

export function getSignUpErrorKey(error: unknown): SignUpErrorKey {
  const { code, message, status } = errorDetails(error);

  if (
    status === 429 ||
    code.includes("rate_limit") ||
    code.includes("over_email_send") ||
    message.includes("email rate limit")
  ) {
    return "emailRateLimit";
  }

  return "failed";
}

export function isAuthenticationRequiredError(error: unknown) {
  const { code, message } = errorDetails(error);

  return Boolean(
    code === "authentication_required" ||
      message.includes("authentication required"),
  );
}
