import ComingSoon from '@/components/ComingSoon';

// M8 spec §9a — čeka M23 (Znanje), koji još nema kod.
export default async function KnowledgeShareLinkPlaceholder({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <ComingSoon locale={locale} />;
}
