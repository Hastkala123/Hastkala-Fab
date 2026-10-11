import type { Prisma } from "@prisma/client";
import { formatIndianMobile } from "@/lib/phone";

type Snapshot = {
  fullName?: string;
  phone?: string;
  line1?: string;
  line2?: string | null;
  landmark?: string | null;
  city?: string;
  state?: string;
  pincode?: string;
};

/** Renders the address copied onto an order when it was placed. */
export default function AddressBlock({ value }: { value: Prisma.JsonValue }) {
  const a = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Snapshot;
  return (
    <address className="mt-1 not-italic text-slate-700">
      {a.fullName}
      <br />
      {a.line1}
      {a.line2 && (
        <>
          <br />
          {a.line2}
        </>
      )}
      {a.landmark && (
        <>
          <br />
          {a.landmark}
        </>
      )}
      <br />
      {a.city}, {a.state} {a.pincode}
      {a.phone && (
        <>
          <br />
          Phone: {formatIndianMobile(a.phone)}
        </>
      )}
    </address>
  );
}
