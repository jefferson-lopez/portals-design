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
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
      <div className="flex max-w-xl flex-col items-center gap-3">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Starnext
        </h1>
        <p className="text-balance text-muted-foreground">
          {isEnglish
            ? "A minimal Next.js starter with theme, UI and internationalization ready."
            : "Un starter mínimo de Next.js con tema, UI e internacionalización listos."}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href="https://github.com/jefferson-lopez/starnext"
          target="_blank"
          rel="noreferrer"
          className={buttonVariants()}
        >
          {isEnglish ? "View on GitHub" : "Ver en GitHub"}
        </a>
        <Link
          href="/"
          locale={nextLocale}
          className={buttonVariants({ variant: "secondary" })}
        >
          {isEnglish ? "Ver en español" : "View in English"}
        </Link>
      </div>
    </main>
  );
}
