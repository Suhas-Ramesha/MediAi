import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  markClassName?: string;
  wordmark?: boolean;
};

export function BrandMark({
  className,
  markClassName,
  wordmark = true,
}: BrandMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className={cn(
          "grid h-8 w-8 place-items-center rounded-[0.65rem] bg-primary text-primary-foreground",
          markClassName,
        )}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path
            d="M4 13h3.2l2-6 3.6 10 2.2-4H20"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {wordmark ? (
        <span className="font-display text-lg leading-none tracking-tight">
          MediAI
        </span>
      ) : null}
    </span>
  );
}
