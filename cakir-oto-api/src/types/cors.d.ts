declare module "cors" {
  import type { RequestHandler } from "express";

  type CorsOptions = {
    origin?: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => void;
    credentials?: boolean;
    allowedHeaders?: string[];
  };

  export default function cors(options?: CorsOptions): RequestHandler;
}
