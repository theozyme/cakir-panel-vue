import type { ChangeEvent } from "react";

export const toBusinessUppercase = (value: string) => value.toLocaleUpperCase("tr-TR");

export function uppercaseBusinessInput(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
  const input = event.currentTarget;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const original = input.value;
  input.value = toBusinessUppercase(original);
  if (start !== null && end !== null) {
    input.setSelectionRange(toBusinessUppercase(original.slice(0, start)).length, toBusinessUppercase(original.slice(0, end)).length);
  }
}
