import { z } from "zod";

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// A student's payment fields as the forms send them (student form, finance tab).
export const PaymentBodyShape = {
  payment_method: z.string().trim().max(60).nullable().optional(),
  payment_amount: z.number().int().min(0).max(100000).nullable().optional(),
  last_payment_date: IsoDate.nullable().optional(),
  next_payment_date: IsoDate.nullable().optional(),
  first_training_date: IsoDate.nullable().optional(),
  payment_notes: z.string().max(500).optional(),
  payment_frozen: z.boolean().optional(),
};

export type PaymentInput = {
  payment_method?: string | null;
  payment_amount?: number | null;
  last_payment_date?: string | null;
  next_payment_date?: string | null;
  first_training_date?: string | null;
  payment_notes?: string;
  payment_frozen?: boolean;
};
