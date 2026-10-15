import { Query } from "./database";
import { rpc } from "./operations";
import { storage } from "./storage";
import { serverAuth } from "./auth";
export const admin = {
  from: (table: string) => new Query(table),
  rpc,
  storage,
  auth: serverAuth,
};
export function checked<T>(value: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (value.error) throw Error(value.error.message);
  return value.data as NonNullable<T>;
}
