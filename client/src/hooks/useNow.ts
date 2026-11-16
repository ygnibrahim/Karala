import { useEffect, useState } from 'react';

/** Belirli aralıklarla güncellenen "şu an" değeri (geri sayımlar için). */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
