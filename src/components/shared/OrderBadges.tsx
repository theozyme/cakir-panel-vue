import { cn } from "@/lib/utils";
import {
  orderStatusLabels,
  paymentStatusLabels,
  type OrderPaymentStatus,
  type OrderStatus,
} from "@/types/orders";

const statusTone: Record<OrderStatus, string> = {
  taslak: "bg-muted text-muted-foreground",
  verildi: "bg-primary/10 text-primary",
  hazirlaniyor: "bg-warning/20 text-warning",
  kargoda: "bg-primary/15 text-primary",
  kismi_teslim: "bg-warning/20 text-warning",
  teslim_edildi: "bg-success/15 text-success",
  iptal: "bg-destructive/10 text-destructive",
};

const payTone: Record<OrderPaymentStatus, string> = {
  odenmedi: "bg-destructive/10 text-destructive",
  kismi: "bg-warning/20 text-warning",
  odendi: "bg-success/15 text-success",
};

const base =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={cn(base, statusTone[status])}>{orderStatusLabels[status]}</span>;
}

export function PaymentStatusBadge({ status }: { status: OrderPaymentStatus }) {
  return <span className={cn(base, payTone[status])}>{paymentStatusLabels[status]}</span>;
}
