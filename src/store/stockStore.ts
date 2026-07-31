import { useSyncExternalStore } from "react";
import { mockStock } from "@/data/mock";
import { mockOrders, mockSuppliers } from "@/data/mockOrders";
import type { StockItem } from "@/types";
import type {
  OrderPayment,
  OrderPaymentStatus,
  OrderStatus,
  PurchaseOrder,
} from "@/types/orders";

/**
 * Faz 1: bellek içi mock store.
 * Gelecekte REST API ile değiştirilecek (aynı fonksiyon imzaları korunabilir).
 */

type State = {
  stock: StockItem[];
  orders: PurchaseOrder[];
};

let state: State = {
  stock: mockStock.map((s) => ({ ...s })),
  orders: mockOrders.map((o) => ({
    ...o,
    kalemler: o.kalemler.map((k) => ({ ...k })),
    gecmis: [...o.gecmis],
    odemeler: [...o.odemeler],
  })),
};

const listeners = new Set<() => void>();

function emit(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return state;
}

export function useStockStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export const suppliers = mockSuppliers;

export function nextOrderNo() {
  const nums = state.orders
    .map((o) => Number(o.no.split("-").pop()))
    .filter((n) => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `SIP-2026-${String(max + 1).padStart(4, "0")}`;
}

export function createOrder(order: PurchaseOrder) {
  emit({ ...state, orders: [order, ...state.orders] });
}

export function updateOrder(id: string, patch: Partial<PurchaseOrder>) {
  emit({
    ...state,
    orders: state.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)),
  });
}

export function setOrderStatus(id: string, durum: OrderStatus, aciklama?: string) {
  emit({
    ...state,
    orders: state.orders.map((o) =>
      o.id === id
        ? {
            ...o,
            durum,
            gecmis: [
              ...o.gecmis,
              {
                tarih: new Date().toISOString().slice(0, 10),
                durum,
                aciklama: aciklama ?? "Durum güncellendi",
              },
            ],
          }
        : o,
    ),
  });
}

export function addPayment(id: string, payment: OrderPayment, toplam: number) {
  emit({
    ...state,
    orders: state.orders.map((o) => {
      if (o.id !== id) return o;
      const odemeler = [...o.odemeler, payment];
      const odenen = odemeler.reduce((t, p) => t + p.tutar, 0);
      const odemeDurumu: OrderPaymentStatus =
        odenen <= 0 ? "odenmedi" : odenen >= toplam ? "odendi" : "kismi";
      return { ...o, odemeler, odemeDurumu };
    }),
  });
}

/** Teslimat girişi: sipariş kalemlerini ve stok adetlerini günceller. */
export function receiveDelivery(orderId: string, gelen: Record<string, number>) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return;

  const kalemler = order.kalemler.map((k) => {
    const add = Math.max(0, Math.min(gelen[k.stokId] ?? 0, k.adet - k.teslimEdilen));
    return { ...k, teslimEdilen: k.teslimEdilen + add };
  });

  const tamam = kalemler.every((k) => k.teslimEdilen >= k.adet);
  const herhangi = kalemler.some((k) => k.teslimEdilen > 0);
  const durum: OrderStatus = tamam ? "teslim_edildi" : herhangi ? "kismi_teslim" : order.durum;

  const stock = state.stock.map((s) => {
    const add = Math.max(0, gelen[s.id] ?? 0);
    const kalem = order.kalemler.find((k) => k.stokId === s.id);
    if (!kalem || add <= 0) return s;
    const eklenecek = Math.min(add, kalem.adet - kalem.teslimEdilen);
    return { ...s, adet: s.adet + eklenecek };
  });

  emit({
    stock,
    orders: state.orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            kalemler,
            durum,
            gecmis: [
              ...o.gecmis,
              {
                tarih: new Date().toISOString().slice(0, 10),
                durum,
                aciklama: tamam ? "Tüm ürünler teslim alındı" : "Kısmi teslimat girildi",
              },
            ],
          }
        : o,
    ),
  });
}
