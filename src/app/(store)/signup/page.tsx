import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Create an Account",
  description:
    "Create a Hastkala Fab account for faster checkout, order tracking and wishlists. Retailers can register for wholesale trade pricing.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/account");

  const params = await searchParams;
  const wholesale = params.type === "wholesale";

  return (
    <div className="hf-container flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-indigo-ink-950">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Faster checkout, order tracking and a wishlist that follows you across
            devices.
          </p>
        </div>

        <div className="hf-card mt-6 p-6 sm:p-8">
          <SignupForm defaultWholesale={wholesale} />
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="hf-link font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
