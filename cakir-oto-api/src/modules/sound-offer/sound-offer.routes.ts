import { Router } from "express";

import {
  getSoundOfferController,
  getSoundOffers,
  postSoundOffer,
} from "./sound-offer.controller.js";

export const soundOfferRouter = Router();

soundOfferRouter.get("/", getSoundOffers);
soundOfferRouter.post("/", postSoundOffer);
soundOfferRouter.get("/:id", getSoundOfferController);
