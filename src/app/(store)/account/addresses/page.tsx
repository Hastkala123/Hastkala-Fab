import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import AddressBook from "./AddressBook";

export const metadata: Metadata = {
  title: "My Addresses",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const user = await requireUser();

  const addresses = await db.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950 sm:text-3xl">
        Saved addresses
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Save up to 10 delivery addresses for faster checkout.
      </p>

      <AddressBook
        addresses={addresses.map((a) => ({
          id: a.id,
          fullName: a.fullName,
          phone: a.phone,
          line1: a.line1,
          line2: a.line2,
          city: a.city,
          state: a.state,
          pincode: a.pincode,
          type: a.type,
          isDefault: a.isDefault,
        }))}
      />
    </div>
  );
}
