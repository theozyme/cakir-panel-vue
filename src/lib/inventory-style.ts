import type { InventoryStatus } from "@/types/inventory";

export const inventoryStockHighlightClass = (status?: InventoryStatus | null): string =>
  status === "OUT_OF_STOCK" || status === "CRITICAL"
    ? "bg-destructive/10 hover:bg-destructive/15"
    : "bg-success/10 hover:bg-success/15";
