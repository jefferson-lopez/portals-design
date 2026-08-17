import { IconArrowLeft, IconFolderCode, IconHome } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Link } from "@/i18n/navigation";

type RouteNotFoundProps = {
  title: string;
  description: string;
  viewProjectsLabel: string;
  goHomeLabel: string;
  locale?: string;
};

export function RouteNotFound({
  title,
  description,
  viewProjectsLabel,
  goHomeLabel,
  locale,
}: RouteNotFoundProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconFolderCode />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row flex-wrap justify-center">
          <Button
            nativeButton={false}
            render={<Link href="/home" locale={locale} />}
          >
            <IconArrowLeft data-icon="inline-start" />
            {viewProjectsLabel}
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/" locale={locale} />}
            variant="outline"
          >
            <IconHome data-icon="inline-start" />
            {goHomeLabel}
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
