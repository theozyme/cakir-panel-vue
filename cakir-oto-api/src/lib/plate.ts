import { HttpError } from "./http-error.js";

export const normalizePlate = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new HttpError(400, "plate string olmali");
  }

  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");

  if (!normalized) {
    throw new HttpError(400, "plate bos olamaz");
  }

  if (normalized.length > 20) {
    throw new HttpError(400, "plate en fazla 20 karakter olmali");
  }

  return normalized;
};
