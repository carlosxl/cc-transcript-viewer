import { createPortal } from 'react-dom'
import { useOverlays } from '@/stores/useOverlays'

/**
 * Full-screen image preview triggered by clicking `[Image #N]` placeholders in
 * user prompts. Backdrop click and Esc both close it (Esc handled globally by
 * useKeyboard via closeTop()).
 */
export function ImageLightbox() {
  const open = useOverlays((s) => s.image.open)
  const src = useOverlays((s) => s.image.src)
  const alt = useOverlays((s) => s.image.alt)
  const close = useOverlays((s) => s.closeImage)

  if (!open || !src) return null
  return createPortal(
    <div
      className="image-lightbox fixed inset-0 z-[100] flex items-center justify-center"
      onClick={close}
      style={{ background: 'rgba(0, 0, 0, 0.78)', backdropFilter: 'blur(2px)' }}
    >
      <img
        src={src}
        alt={alt ?? 'Image preview'}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '92vw',
          maxHeight: '92vh',
          objectFit: 'contain',
          boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
          borderRadius: 6,
          background: 'var(--surface-1)',
        }}
      />
    </div>,
    document.body,
  )
}
