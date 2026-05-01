"use client";

import { useState, useEffect } from 'react';
import type { RxQuery } from 'rxdb';

export function useRxQuery<T>(query: RxQuery<any, any> | undefined) {
  const [result, setResult] = useState<T[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!query) {
      setIsFetching(false);
      return;
    }

    const subscription = query.$.subscribe((results) => {
      setResult(results);
      setIsFetching(false);
    });

    return () => subscription.unsubscribe();
  }, [query]);

  return { result, isFetching };
}
