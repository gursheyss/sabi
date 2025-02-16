import { getBrands, getConnectedSlackWorkspace } from "@/app/_actions/brands";
import { BrandGrid } from "@/components/brand-grid";

export default async function HomePage() {
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
