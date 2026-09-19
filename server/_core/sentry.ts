import * as Sentry from "@sentry/node";
import { ENV } from "./env";

let isSentryInitialized = false;

export function initSentry() {
  if (isSentryInitialized) return;

  if (!ENV.sentryDsn) {
    console.log("[Sentry] No SENTRY_DSN configured; centralized error reporting is in no-op mode.");
    return;
  }

  try {
    Sentry.init({
      dsn: ENV.sentryDsn,
      environment: ENV.isProduction ? "production" : "development",
      tracesSampleRate: ENV.isProduction ? 0.2 : 1.0,
      beforeSend(event) {
        // Redact any potential private key or secret material before sending to Sentry
        if (event.request?.data && typeof event.request.data === "string") {
          event.request.data = event.request.data.replace(
            /(-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----)/g,
            "[REDACTED_PRIVATE_KEY]"
          );
        }

        // Scrub authorization headers or cookie secrets
        if (event.request?.headers) {
          if (event.request.headers.authorization) {
            event.request.headers.authorization = "[REDACTED]";
          }
          if (event.request.headers.cookie) {
            event.request.headers.cookie = "[REDACTED]";
          }
        }

        return event;
      },
    });

    isSentryInitialized = true;
    console.log("[Sentry] Centralized error tracking initialized successfully.");
  } catch (error) {
    console.error("[Sentry] Failed to initialize Sentry:", error);
  }
}

export function captureException(
  error: unknown,
  context?: {
    requestId?: string;
    userId?: number | string;
    path?: string;
    extra?: Record<string, unknown>;
  }
) {
  if (!isSentryInitialized) return;

  Sentry.withScope((scope) => {
    if (context?.requestId) {
      scope.setTag("requestId", context.requestId);
    }
    if (context?.path) {
      scope.setTag("path", context.path);
    }
    if (context?.userId) {
      scope.setUser({ id: String(context.userId) });
    }
    if (context?.extra) {
      scope.setExtras(context.extra);
    }

    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(String(error), "error");
    }
  });
}

export { Sentry };
