import { getBrands } from "@/app/_actions/brands";
import { BrandGrid } from "@/components/brand-grid";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function MyBrandsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const brands = await getBrands();

  return (
    <div className="p-4 pt-0">
      <BrandGrid initialBrands={brands} />
    </div>
  );
}
