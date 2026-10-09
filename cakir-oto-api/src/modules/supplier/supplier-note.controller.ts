import type { NextFunction, Request, Response } from "express";

import {
  createSupplierNote,
  deleteSupplierNote,
  listSupplierNotes,
  updateSupplierNote,
} from "./supplier-note.service.js";

const param = (req: Request, name: string): string => {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
};

export const getNotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listSupplierNotes(param(req, "supplierId")));
  } catch (error) {
    next(error);
  }
};

export const postNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await createSupplierNote(param(req, "supplierId"), req.body));
  } catch (error) {
    next(error);
  }
};

export const patchNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await updateSupplierNote(param(req, "supplierId"), param(req, "noteId"), req.body));
  } catch (error) {
    next(error);
  }
};

export const deleteNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteSupplierNote(param(req, "supplierId"), param(req, "noteId"));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
