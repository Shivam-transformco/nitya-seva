import { z } from "zod";
import { DELETED_KINDS } from "../../domain/types.js";
import { pagination } from "../../lib/http.js";

export const listBinQuery = pagination.extend({ kind: z.enum(DELETED_KINDS).optional() });
