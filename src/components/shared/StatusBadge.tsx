import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "destructive" | "primary" | "muted";

const toneMap: Record<Tone, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  primary: "bg-primary/10 text-primary",
  muted: "bg-muted text-muted-foreground",
};

export function StatusBadge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        toneMap[tone],
      )}
    >
      {children}
    </span>
  );
}

export function formatTRY(n: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatUSD(n: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
