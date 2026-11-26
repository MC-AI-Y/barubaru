/**
 * Logo YOFC versi web (sudah dipangkas dan dikecilkan, lihat scripts/prepare-logo.mjs).
 * Memakai <picture> agar browser memilih WebP, dengan PNG sebagai cadangan.
 * Rasio asli setelah dipangkas: 1888 x 736 (≈ 2,565 : 1).
 */
const RATIO = 1888 / 736;

export interface BrandLogoProps {
  /** Tinggi tampilan dalam piksel CSS. */
  height?: number;
  className?: string;
  priority?: boolean;
}

export function BrandLogo({ height = 32, className, priority = false }: BrandLogoProps) {
  const width = Math.round(height * RATIO);
  return (
    <picture className={className}>
      <source type="image/webp" srcSet="/logo/yofc-logo.webp 1x, /logo/yofc-logo@2x.webp 2x" />
      <img
        src="/logo/yofc-logo.png"
        srcSet="/logo/yofc-logo.png 1x, /logo/yofc-logo@2x.png 2x"
        alt="YOFC: Smart Link Better Life"
        width={width}
        height={height}
        style={{ width, height }}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        draggable={false}
      />
    </picture>
  );
}
