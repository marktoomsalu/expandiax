import { redirect } from "next/navigation";

/** /wrapped: this year's (in January, last year's). */
export default function WrappedNow() {
  const now = new Date();
  redirect(`/wrapped/${now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}`);
}
