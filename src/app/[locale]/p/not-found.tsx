import { IconFolderCode } from "@tabler/icons-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconFolderCode />
          </EmptyMedia>
          <EmptyTitle>Proyecto no encontrado</EmptyTitle>
          <EmptyDescription>
            Este portal es privado o no está publicado.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  );
}
