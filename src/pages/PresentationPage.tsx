import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BookOpen, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";

/** Official ORA product brief — same-origin app resource (bytes unchanged). */
export const PRESENTATION_PDF_URL = "/ora/ORA_Product_Brief_v1.0.pdf";
export const PRESENTATION_PDF_NAME = "ORA_Product_Brief_v1.0.pdf";

export function PresentationPage() {
  const { t } = useTranslation();
  const [showViewer, setShowViewer] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  const openViewer = () => {
    setShowViewer(true);
    // Wait for the viewer to render before scrolling to it.
    window.setTimeout(() => {
      viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
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
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-tight">{t("presentation.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("presentation.subtitle")}</p>
            </div>
          </div>
        </header>

        <div className="mt-8 rounded-xl border bg-card p-6">
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {t("presentation.description")}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={openViewer}>
              <Eye className="h-4 w-4" /> {t("presentation.view")}
            </Button>
            <Button asChild variant="outline">
              <a href={PRESENTATION_PDF_URL} download={PRESENTATION_PDF_NAME}>
                <Download className="h-4 w-4" /> {t("presentation.download")}
              </a>
            </Button>
          </div>
          {showViewer && (
            <p className="mt-3 text-xs text-muted-foreground">{t("presentation.viewerHint")}</p>
          )}
        </div>

        {showViewer && (
          <div ref={viewerRef} className="mt-6 overflow-hidden rounded-xl border bg-muted/30 p-1 sm:p-2">
            <iframe
              title={t("presentation.title")}
              src={PRESENTATION_PDF_URL}
              className="h-[76vh] w-full rounded-lg border bg-white"
            />
          </div>
        )}

        <p className="mt-8 text-xs text-muted-foreground">{t("presentation.footnote")}</p>
      </div>
    </div>
  );
}
