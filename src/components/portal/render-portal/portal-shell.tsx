import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PortalShell({
  children,
  className,
  sidebar,
}: {
  children: ReactNode;
  className?: string;
  sidebar?: ReactNode;
}) {
  return (
    <main className={cn("min-h-dvh bg-background text-foreground", className)}>
      <div className="mx-auto grid max-w-[900px] gap-8 px-6 py-8 lg:grid-cols-[240px_1fr]">
        {sidebar ? (
          <aside className="hidden lg:block">
            <div className="fixed top-8 bottom-8 left-[max(1.5rem,calc((100vw-900px)/2+1.5rem))] w-60">
              {sidebar}
            </div>
          </aside>
        ) : null}
        {children}
      </div>
    </main>
  );
}
