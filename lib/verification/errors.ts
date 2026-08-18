import { AuditExtractionError } from "../audit/extract";

export type VerificationErrorCode =
  | "INVALID_REQUEST"
  | "SERVER_CONFIGURATION"
  | "GEMINI_QUOTA"
  | "GEMINI_RATE_LIMIT"
  | "GEMINI_TIMEOUT"
  | "GEMINI_INVALID_OUTPUT"
  | "GEMINI_UNAVAILABLE"
  | "VERIFICATION_INTERRUPTED";

export type PublicVerificationError = {
  code: VerificationErrorCode;
  message: string;
  suggestion: string;
  source: "request" | "server" | "gemini" | "pipeline";
  retryable: boolean;
};

export function publicVerificationError(error: unknown): PublicVerificationError {
  if (error instanceof AuditExtractionError) {
    return {
      code: error.code,
      message: error.message,
      suggestion: error.suggestion,
      source: "gemini",
      retryable: error.retryable,
    };
  }

  return {
    code: "VERIFICATION_INTERRUPTED",
    message: "Verification stopped before AuditScope could produce a verdict.",
    suggestion: "Try again. If the problem persists, check the configured GitHub, Sourcify, and Base RPC services.",
    source: "pipeline",
    retryable: true,
  };
}
