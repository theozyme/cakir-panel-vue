import { cn } from "@/lib/utils";
import {
  orderStatusLabels,
  paymentStatusLabels,
  type OrderPaymentStatus,
  type OrderStatus,
} from "@/types/orders";

const statusTone: Record<OrderStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ORDERED: "bg-primary/10 text-primary",
  RECEIVED: "bg-success/15 text-success",
  CANCELLED: "bg-destructive/10 text-destructive",
};

const payTone: Record<OrderPaymentStatus, string> = {
  UNPAID: "bg-destructive/10 text-destructive",
  PARTIAL: "bg-warning/20 text-warning",
  PAID: "bg-success/15 text-success",
};

const base =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={cn(base, statusTone[status])}>{orderStatusLabels[status]}</span>;
}

export function PaymentStatusBadge({ status }: { status: OrderPaymentStatus }) {
  return <span className={cn(base, payTone[status])}>{paymentStatusLabels[status]}</span>;
}
