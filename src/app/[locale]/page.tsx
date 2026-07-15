import { IconArrowRight, IconBrandGithub } from "@tabler/icons-react";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

export default function Home({ params }: Props) {
  const { locale } = use(params);

  setRequestLocale(locale);

  const isEnglish = locale === "en";
  const nextLocale = isEnglish ? "es" : "en";

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-8 bg-background px-6 py-16 text-center text-foreground">
      <section className="flex max-w-3xl flex-col items-center gap-5">
        <p className="rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground">
          {isEnglish
            ? "Client portals for branding projects"
            : "Portales para proyectos de branding"}
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          Portals Design
        </h1>
        <p className="max-w-2xl text-balance text-lg text-muted-foreground">
          {isEnglish
            ? "Organize, present, and deliver branding projects through focused, professional portals. No CRM. No tasks. No noise."
            : "Organiza, presenta y entrega proyectos de branding mediante portales enfocados y profesionales. Sin CRM. Sin tareas. Sin ruido."}
        </p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href="https://github.com/jefferson-lopez/portals-design"
          target="_blank"
          rel="noreferrer"
          className={buttonVariants()}
        >
          <IconBrandGithub data-icon="inline-start" />
          {isEnglish ? "View repository" : "Ver repositorio"}
        </a>
        <Link
          href="/"
          locale={nextLocale}
          className={buttonVariants({ variant: "secondary" })}
        >
          {isEnglish ? "Ver en español" : "View in English"}
          <IconArrowRight data-icon="inline-end" />
        </Link>
      </div>
    </main>
  );
}
