import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import PasswordForm from "./PasswordForm";

export const metadata: Metadata = {
  title: "Password & Security",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const user = await requireUser();

  const sessions = await db.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    take: 10,
    select: {
      id: true,
      userAgent: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950 sm:text-3xl">
          Password &amp; security
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Keep your account secure. Changing your password signs out every other
          device.
        </p>
      </div>

      <section className="hf-card p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-indigo-ink-950">
          Change password
        </h2>
        <div className="mt-5 max-w-md">
          <PasswordForm />
        </div>
      </section>

      <section className="hf-card p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-indigo-ink-950">
          Active sessions
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Devices currently signed in to your account.
        </p>

        <ul className="mt-4 divide-y divide-cotton-200">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="hf-clamp-1 text-sm font-medium text-indigo-ink-900">
                  {describeUserAgent(session.userAgent)}
                </p>
                <p className="text-xs text-slate-500">
                  Signed in {formatDateTime(session.createdAt)}
                </p>
              </div>
              {session.id === user.sessionId && (
                <span className="hf-badge shrink-0 text-emerald-700">
                  This device
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="hf-card border-cotton-400 bg-cotton-100 p-5">
        <h2 className="text-sm font-bold text-indigo-ink-950">
          How we protect your account
        </h2>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
          <li>
            Passwords are stored as bcrypt hashes — we never see or store your
            actual password.
          </li>
          <li>
            Sessions use signed, HTTP-only cookies that JavaScript cannot read.
          </li>
          <li>
            After 8 failed sign-in attempts the account is locked for 15 minutes.
          </li>
          <li>
            We never ask for your password, OTP or card details over phone, email
            or WhatsApp.
          </li>
        </ul>
      </section>
    </div>
  );
}

/** Turns a raw UA string into something a customer can recognise. */
function describeUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device";

  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "Browser";

  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown OS";

  return `${browser} on ${os}`;
}
