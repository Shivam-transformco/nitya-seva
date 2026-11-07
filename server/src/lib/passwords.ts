import bcrypt from "bcryptjs";

const COST = 10;
export const MIN_PASSWORD_LENGTH = 10;

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// Compared against when the email doesn't exist, so response time doesn't reveal which emails are registered.
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(plain: string): Promise<false> {
  dummyHash ??= bcrypt.hash("not-a-real-password", COST);
  await bcrypt.compare(plain, await dummyHash);
  return false;
}
