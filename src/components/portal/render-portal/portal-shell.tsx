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
      <div
        className={cn(
          "mx-auto grid w-full gap-8 px-6 py-8",
          sidebar
            ? "max-w-[900px] lg:grid-cols-[240px_1fr]"
            : "max-w-[900px] lg:max-w-[calc(900px-240px-2rem)]",
        )}
      >
        {sidebar ? (
          <aside className="hidden lg:block">
            <div className="sticky top-8 h-[calc(100dvh-4rem)] w-60">
              {sidebar}
            </div>
          </aside>
        ) : null}
        {children}
      </div>
    </main>
  );
}
