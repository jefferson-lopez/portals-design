import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

type Props = {
  params: Promise<{ locale: string }>;
};

export default function Home({ params }: Props) {
  const { locale } = use(params);

  setRequestLocale(locale);

  const t = useTranslations("HomePage");

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-background px-6 py-24 text-foreground">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <div className="flex max-w-3xl flex-col gap-6">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-[0.24em]">
            {t("eyebrow")}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            {t("description")}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button>{t("primaryAction")}</Button>
            <a
              href="https://nextjs.org/docs"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              {t("secondaryAction")}
            </a>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {["next", "ui", "theme", "i18n"].map((item) => (
            <article
              key={item}
              className="rounded-xl border bg-card p-5 text-card-foreground shadow-xs"
            >
              <h2 className="text-sm font-medium text-muted-foreground">
                {t("stackTitle")}
              </h2>
              <p className="mt-3 text-base font-medium">{t(`stack.${item}`)}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
