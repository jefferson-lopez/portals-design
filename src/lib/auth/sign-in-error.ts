export type SignInErrorKey = "failed" | "invalidCredentials";

export function getSignInErrorKey(error: unknown): SignInErrorKey {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "invalid_credentials"
  ) {
    return "invalidCredentials";
  }

  return "failed";
}
