const TEXT = {
  en: {
    title: 'The report is in final review',
    body: 'The report comes back on this page soon. The map, the graph and the data stay open.',
  },
  fr: {
    title: 'Le rapport est en relecture finale',
    body: 'Le rapport revient bientôt sur cette page. La carte, le graphe et les données restent ouverts.',
  },
} as const;

/** The page of the report while the report is out of production: one short notice. */
export function ReportNotice({ lang = 'en' }: { readonly lang?: 'en' | 'fr' }) {
  const text = TEXT[lang];
  return (
    <div lang={lang} className="mx-auto max-w-prose px-4 py-16">
      <h1 className="text-xl font-semibold text-foreground">{text.title}</h1>
      <p className="mt-4 text-muted-foreground">{text.body}</p>
    </div>
  );
}
