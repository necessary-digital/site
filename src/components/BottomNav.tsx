"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();
  const onCodrop = pathname?.startsWith("/codrop");
  const onRubens = pathname?.startsWith("/rubens");
  const onHelmet = !onCodrop && !onRubens;

  return (
    <nav className="bottomNav" aria-label="Pages">
      <Link className={onHelmet ? "isActive" : ""} href="/">
        Helmet
      </Link>
      <Link className={onCodrop ? "isActive" : ""} href="/codrop">
        Codrop
      </Link>
      <Link className={onRubens ? "isActive" : ""} href="/rubens">
        Rubens
      </Link>
    </nav>
  );
}
