"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function LeadsPageStateSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    const value = query ? `${pathname}?${query}` : pathname;
    document.cookie = `lastLeadsPath=${encodeURIComponent(value)}; path=/; max-age=2592000; samesite=lax`;
  }, [pathname, searchParams]);

  return null;
}
