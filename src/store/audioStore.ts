import { useSyncExternalStore } from "react";
import { mockAudioProducts, mockQuotes } from "@/data/mockAudio";
import type { AudioProduct, Quote } from "@/types/audio";

/** Faz 1: bellek içi mock store (ileride REST API ile değiştirilecek). */

type State = {
  products: AudioProduct[];
  quotes: Quote[];
};

let state: State = {
  products: mockAudioProducts.map((p) => ({ ...p })),
  quotes: mockQuotes.map((q) => ({ ...q, kalemler: q.kalemler.map((k) => ({ ...k })) })),
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

export function useAudioStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function addAudioProduct(product: AudioProduct) {
  emit({ ...state, products: [product, ...state.products] });
}

export function updateAudioProduct(id: string, patch: Partial<AudioProduct>) {
  emit({
    ...state,
    products: state.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  });
}

export function deleteAudioProduct(id: string) {
  emit({ ...state, products: state.products.filter((p) => p.id !== id) });
}

export function nextQuoteNo() {
  const nums = state.quotes
    .map((q) => Number(q.no.split("-").pop()))
    .filter((n) => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `TKF-2026-${String(max + 1).padStart(4, "0")}`;
}

export function createQuote(quote: Quote) {
  emit({ ...state, quotes: [quote, ...state.quotes] });
}
