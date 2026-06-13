'use client';

import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { API_URL } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import type { Attachment } from '@/lib/types';

/** Inline preview for an attachment: image lightbox, PDF embed, or file card. */
export function AttachmentPreview({
  attachment,
  onClose,
}: {
  attachment: Attachment | null;
  onClose: () => void;
}) {
  const open = !!attachment;
  const src = attachment ? `${API_URL}${attachment.url}` : '';
  const isImage = attachment?.mimeType.startsWith('image/');
  const isPdf = attachment?.mimeType === 'application/pdf';

  return (
    <Modal open={open} onClose={onClose} title={attachment?.originalName} description={attachment ? formatBytes(attachment.size) : undefined} className="max-w-3xl">
      {attachment && (
        <div className="p-4">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={attachment.originalName} className="mx-auto max-h-[70vh] w-auto rounded-xl border border-line" />
          ) : isPdf ? (
            <iframe src={src} title={attachment.originalName} className="h-[70vh] w-full rounded-xl border border-line" />
          ) : (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-elevated text-ink-soft">
                <FileText className="h-7 w-7" />
              </div>
              <p className="text-sm text-ink-soft">
                This file type can’t be previewed inline.
              </p>
              <a href={src} target="_blank" rel="noreferrer">
                <Button variant="secondary">
                  <Download className="h-4 w-4" /> Download to view
                </Button>
              </a>
            </div>
          )}

          {(isImage || isPdf) && (
            <div className="mt-4 flex justify-end">
              <a href={src} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4" /> Open original
                </Button>
              </a>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
