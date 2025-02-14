import { getBrands, getConnectedSlackWorkspace } from "@/app/_actions/brands";
import { BrandGrid } from "@/components/brand-grid";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function MyBrandsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [brands, slackWorkspace] = await Promise.all([
    getBrands(),
    getConnectedSlackWorkspace(),
  ]);

  return (
    <div className="p-4 pt-0">
      <BrandGrid initialBrands={brands} hasSlackWorkspace={!!slackWorkspace} />
    </div>
  );
}
