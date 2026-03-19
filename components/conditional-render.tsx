"use client";

import { usePathname } from "next/navigation";

export default function ConditionalRender({
  hideOnPrefix,
  children,
}: {
  hideOnPrefix: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname?.startsWith(hideOnPrefix)) return null;
  return <>{children}</>;
}

