"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();
  const onCodrop = pathname?.startsWith("/codrop");

  return (
    <nav className="bottomNav" aria-label="Pages">
      <Link className={onCodrop ? "" : "isActive"} href="/">
        Helmet
      </Link>
      <Link className={onCodrop ? "isActive" : ""} href="/codrop">
        Codrop
      </Link>
    </nav>
  );
}
