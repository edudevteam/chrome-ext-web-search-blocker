import { useEffect, useState } from 'react';
import { loadPendingUpdate, onPendingUpdateChanged } from '../update';

/** The downloaded version waiting to install, kept live as the background records it. */
export function usePendingUpdate(): string | null {
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    void loadPendingUpdate().then(setPending);
    return onPendingUpdateChanged(setPending);
  }, []);

  return pending;
}
