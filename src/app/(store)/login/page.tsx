import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/routes";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Hastkala Fab account to track orders, save favourites and check out faster.",
  // Auth pages carry no SEO value and should never appear in search results.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; registered?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;

  if (user) redirect(safeNext(params.next));

  return (
    <div className="hf-container flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-indigo-ink-950">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to track orders, save favourites and check out faster.
          </p>
        </div>

        {params.registered === "1" && (
          <div
            role="status"
            className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            Your account has been created. Sign in to continue.
          </div>
        )}

        <div className="hf-card mt-6 p-6 sm:p-8">
          <LoginForm next={safeNext(params.next)} />
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          New to Hastkala Fab?{" "}
          <Link href="/signup" className="hf-link font-semibold">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Only ever redirect to a path on this site (see safeRedirectPath). */
function safeNext(next: string | undefined): string {
  return safeRedirectPath(next);
}
