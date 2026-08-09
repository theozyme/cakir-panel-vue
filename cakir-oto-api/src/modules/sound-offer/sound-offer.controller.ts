import type { NextFunction, Request, Response } from "express";

import { createSoundOffer, getSoundOffer, listSoundOffers } from "./sound-offer.service.js";

export const postSoundOffer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await createSoundOffer(req.body));
  } catch (error) {
    next(error);
  }
};

export const getSoundOfferController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getSoundOffer(req.params.id ?? ""));
  } catch (error) {
    next(error);
  }
};

export const getSoundOffers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listSoundOffers());
  } catch (error) {
    next(error);
  }
};
