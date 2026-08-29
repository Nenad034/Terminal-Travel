'use client';

import { useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { addContentMedia, removeContentMedia } from '../actions';
import { Button } from '@/components/ui/button';

interface ContentMediaItem {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO';
  fileName: string;
  sizeBytes: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// M12 spec §2.5/§7 (23.8.2026, na zahtev vlasnika: "kako dodajemo slike i reels?") — galerija
// slika/video uz sadržaj. `canEdit` prati isto pravilo kao TranslationsPanel.tsx (izmena
// zaključana čim sadržaj uđe u APPROVED/PUBLISHED, M12 spec §3 nepovratna granica).
export default function MediaGallery({ contentId, media, canEdit }: { contentId: string; media: ContentMediaItem[]; canEdit: boolean }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const result = await addContentMedia(contentId, file);
    if (result.error) setError(result.error);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploading(false);
  }

  async function handleRemove(mediaId: string) {
    setError(null);
    const result = await removeContentMedia(contentId, mediaId);
    if (result.error) setError(result.error);
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Slike i video (reels)</h2>
        {canEdit && (
          <>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
            <Button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
              className="h-auto gap-1.5 px-2 py-1 text-[11px]"
            >
              <Icon name={uploading ? 'loading' : 'cloud-upload'} className={uploading ? 'animate-spin' : ''} />
              {uploading ? 'Otpremam…' : 'Dodaj sliku/video'}
            </Button>
          </>
        )}
      </div>

      {error && <p className="mb-3 rounded bg-danger-bg p-2 text-[11px] text-danger">{error}</p>}

      {media.length === 0 ? (
        <p className="text-xs text-ink-faint">Nema priloženih slika/video zapisa.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {media.map((m) => (
            <div key={m.id} className="group relative overflow-hidden rounded-lg border border-border bg-panel2">
              {m.mediaType === 'IMAGE' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/marketing/media/${m.id}`} alt={m.fileName} className="h-32 w-full object-cover" />
              ) : (
                <video src={`/api/marketing/media/${m.id}`} controls className="h-32 w-full object-cover" />
              )}
              <div className="flex items-center justify-between gap-1 px-2 py-1 text-xs text-ink-faint">
                <span className="truncate" title={m.fileName}>
                  {m.fileName}
                </span>
                <span className="flex-shrink-0">{formatFileSize(m.sizeBytes)}</span>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleRemove(m.id)}
                  title="Ukloni"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded bg-panel/90 text-ink-faint opacity-0 hover:text-danger group-hover:opacity-100"
                >
                  <Icon name="close" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
