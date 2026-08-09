import { HttpError } from "./http-error.js";

export const asRecord = (value: unknown, fieldName = "body"): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `${fieldName} obje olmali`);
  }

  return value as Record<string, unknown>;
};

export const requiredString = (value: unknown, fieldName: string, maxLength?: number): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${fieldName} zorunlu`);
  }

  const text = value.trim();

  if (maxLength && text.length > maxLength) {
    throw new HttpError(400, `${fieldName} en fazla ${maxLength} karakter olmali`);
  }

  return text;
};

export const optionalString = (
  value: unknown,
  fieldName: string,
  maxLength?: number,
): string | null => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${fieldName} string olmali`);
  }

  const text = value.trim();

  if (!text) return null;

  if (maxLength && text.length > maxLength) {
    throw new HttpError(400, `${fieldName} en fazla ${maxLength} karakter olmali`);
  }

  return text;
};

export const oneOf = <T extends string>(
  value: unknown,
  fieldName: string,
  allowed: readonly T[],
): T => {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new HttpError(400, `${fieldName} gecersiz`);
  }

  return value as T;
};
