"use client";

import Image from "next/image";

interface Props {
  brand: string;
  height?: number;
  className?: string;
}

const SOURCES: Record<string, { src: string; label: string; aspect: number }> = {
  visa: { src: "/visa-logo.svg", label: "Visa", aspect: 3.05 }, // wordmark, wide
  mastercard: { src: "/mc-logo.svg", label: "Mastercard", aspect: 1.55 }, // dual circles
};

// Renders the official card-network logo at a consistent height. Falls back
// to a neutral placeholder for unexpected brand values so the layout doesn't
// jump.
export default function BrandLogo({
  brand,
  height = 22,
  className = "",
}: Props) {
  const spec = SOURCES[brand] ?? SOURCES.mastercard;
  const width = Math.round(height * spec.aspect);
  return (
    <Image
      src={spec.src}
      alt={spec.label}
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}
