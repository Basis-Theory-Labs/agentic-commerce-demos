"use client";

import Image from "next/image";

interface Props {
  brand: string;
  height?: number;
  className?: string;
}

const SOURCES: Record<string, { src: string; label: string; aspect: number }> = {
  visa: { src: "/visa-logo.svg", label: "Visa", aspect: 3.05 },
  mastercard: { src: "/mc-logo.svg", label: "Mastercard", aspect: 1.55 },
};

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
      style={{ width: "auto", height: `${height}px` }}
    />
  );
}
