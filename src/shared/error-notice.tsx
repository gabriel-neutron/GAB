import { Button } from '@/shared/ui/button';

export interface ErrorNoticeProps {
  /** The raw text of the fault, for the operator. It shows only in the closed technical part. */
  readonly detail: string;
  /** The Retry action. Without it, the button loads the page again. */
  readonly onRetry?: () => void;
}

/** What happened, what to do, and a closed "Technical detail" part. The visitor text names no
 * service and gives no operator advice. */
export function ErrorNotice({ detail, onRetry }: ErrorNoticeProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2 p-3 text-xs">
      <p>This page could not load. Try again in a moment. If it keeps failing, tell us.</p>
      <Button
        variant="outline"
        onClick={
          onRetry ??
          (() => {
            window.location.reload();
          })
        }
      >
        Retry
      </Button>
      <details className="max-w-full min-w-0 text-label">
        <summary className="cursor-default">Technical detail</summary>
        <pre className="mt-1 break-words whitespace-pre-wrap">{detail}</pre>
      </details>
    </div>
  );
}
