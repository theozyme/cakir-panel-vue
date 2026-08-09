import { Router } from "express";

import {
  getMultimediaProducts,
  getScreenProducts,
  getSoundSystemProducts,
} from "./stock-lookup.controller.js";

export const stockLookupRouter = Router();

stockLookupRouter.get("/multimedia-products", getMultimediaProducts);
stockLookupRouter.get("/screen-products", getScreenProducts);
stockLookupRouter.get("/sound-system-products", getSoundSystemProducts);
