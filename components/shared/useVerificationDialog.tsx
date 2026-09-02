'use client';

import { useCallback, useRef, useState } from 'react';
import VerificationDialog, { type VerificationTone } from '@/components/shared/VerificationDialog';

type Request = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: VerificationTone;
  details?: string[];
};

export function useVerificationDialog() {
  const [request, setRequest] = useState<Request | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const resolve = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  const verify = useCallback((nextRequest: Request) => new Promise<boolean>((resolvePromise) => {
    resolverRef.current?.(false);
    resolverRef.current = resolvePromise;
    setRequest(nextRequest);
  }), []);

  const verificationDialog = <VerificationDialog
    open={request !== null}
    title={request?.title ?? ''}
    description={request?.description ?? ''}
    confirmLabel={request?.confirmLabel ?? 'Confirm'}
    cancelLabel={request?.cancelLabel}
    tone={request?.tone}
    details={request?.details}
    onCancel={() => resolve(false)}
    onConfirm={() => resolve(true)}
  />;

  return { verify, verificationDialog };
}
