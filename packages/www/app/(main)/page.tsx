import { getBrands, getConnectedSlackWorkspace } from "@/app/_actions/brands";
import { BrandGrid } from "@/components/brand-grid";
import { ConnectSlackModal } from "@/components/connect-slack-modal";

export default async function HomePage() {
  const [brands, slackWorkspace] = await Promise.all([
    getBrands(),
    getConnectedSlackWorkspace(),
  ]);

  return (
    <div className="p-4 pt-0">
      <ConnectSlackModal open={!slackWorkspace} />
      <BrandGrid
        initialBrands={brands}
        hasSlackWorkspace={!!slackWorkspace}
        channels={slackWorkspace?.channels || []}
      />
    </div>
  );
}
