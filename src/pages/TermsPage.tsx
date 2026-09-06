import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileText } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { TERMS_EFFECTIVE_DATE, TERMS_VERSION } from "@/lib/terms";
import { LICENSE_CONTACT_EMAIL } from "@/lib/access/types";

/**
 * Section keys (static i18n keys, one title + one body per section).
 * The body supports paragraphs separated by blank lines (rendered via
 * whitespace-pre-line) and optional {{email}} interpolation.
 */
const SECTIONS: { title: string; body: string }[] = [
  { title: "terms.s01.title", body: "terms.s01.body" },
  { title: "terms.s02.title", body: "terms.s02.body" },
  { title: "terms.s03.title", body: "terms.s03.body" },
  { title: "terms.s04.title", body: "terms.s04.body" },
  { title: "terms.s05.title", body: "terms.s05.body" },
  { title: "terms.s06.title", body: "terms.s06.body" },
  { title: "terms.s07.title", body: "terms.s07.body" },
  { title: "terms.s08.title", body: "terms.s08.body" },
  { title: "terms.s09.title", body: "terms.s09.body" },
  { title: "terms.s10.title", body: "terms.s10.body" },
  { title: "terms.s11.title", body: "terms.s11.body" },
  { title: "terms.s12.title", body: "terms.s12.body" },
  { title: "terms.s13.title", body: "terms.s13.body" },
  { title: "terms.s14.title", body: "terms.s14.body" },
];

export function TermsPage() {
  const { t } = useTranslation();
  const effectiveLabel = TERMS_EFFECTIVE_DATE
    ? new Date(`${TERMS_EFFECTIVE_DATE}T00:00:00`).toLocaleDateString()
    : t("terms.effectivePending");

  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("terms.back")}
        </Link>

        <header className="mt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-tight">{t("terms.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("terms.intro")}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              {t("terms.version")}: {TERMS_VERSION}
            </span>
            <span className="rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              {t("terms.effective")}: {effectiveLabel}
            </span>
          </div>
        </header>

        <div className="mt-8 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.title} className="border-t pt-6 first:border-t-0 first:pt-0">
              <h2 className="text-base font-semibold tracking-tight">{t(section.title)}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {t(section.body, { email: LICENSE_CONTACT_EMAIL })}
              </p>
            </section>
          ))}
        </div>

        <footer className="mt-12 border-t pt-6 text-xs leading-relaxed text-muted-foreground">
          {t("terms.footer", { version: TERMS_VERSION })}
        </footer>
      </div>
    </div>
  );
}
