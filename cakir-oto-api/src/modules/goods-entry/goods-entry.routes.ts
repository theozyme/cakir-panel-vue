import { Router } from "express";
import { getHistory, getProducts, getStatistics, postEntry, postRevision } from "./goods-entry.controller.js";

export const goodsEntryRouter = Router();
goodsEntryRouter.get("/products", getProducts);
goodsEntryRouter.post("/entries", postEntry);
goodsEntryRouter.post("/entries/:id/revisions", postRevision);
goodsEntryRouter.get("/products/:id/history", getHistory);
goodsEntryRouter.get("/statistics", getStatistics);
