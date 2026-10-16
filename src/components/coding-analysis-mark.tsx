import type { SVGProps } from "react";

type CodingAnalysisMarkProps = Omit<SVGProps<SVGSVGElement>, "height" | "width"> & {
  size?: number;
};

export function CodingAnalysisMark({ size = 22, ...props }: CodingAnalysisMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="2.5" y="4.5" width="19" height="15" rx="1.5" />
      <path d="M12 4.5v15M2.5 12h19" opacity=".65" />
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="16.4" cy="8.3" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}
