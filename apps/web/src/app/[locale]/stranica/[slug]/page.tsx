import ComingSoon from '@/components/ComingSoon';

// M8 spec §9a — čeka M12 (Content Engine), koji još nema kod.
export default async function StaticPagePlaceholder({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <ComingSoon locale={locale} />;
}
