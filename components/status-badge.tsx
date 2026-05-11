import { UnderstandingStatus } from "@/lib/types";

type StatusBadgeProps = {
  status: UnderstandingStatus;
};

const styles: Record<UnderstandingStatus, string> = {
  clear: "bg-emerald-100 text-emerald-900 border-emerald-200",
  partial: "bg-amber-100 text-amber-900 border-amber-200",
  stuck: "bg-rose-100 text-rose-900 border-rose-200",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}
