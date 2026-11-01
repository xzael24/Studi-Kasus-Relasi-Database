import { ValueTransformer } from 'typeorm';

// Postgres returns DECIMAL as string; convert to number so JSON/arithmetic stay numeric.
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? value : Number(value),
};
