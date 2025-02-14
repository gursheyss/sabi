"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Plus, Slack } from "lucide-react";
import { BrandCard } from "@/components/brand-card";
import { AddBrandModal } from "@/components/add-brand-modal";
import { createBrand, getConnectedSlackWorkspace } from "@/app/_actions/brands";
import { toast } from "sonner";
import type { Brand as DBBrand } from "@lighthouse/database/src/schema";
interface BrandGridProps {
  initialBrands: DBBrand[];
}

export function BrandGrid({ initialBrands }: BrandGridProps) {
  const [brands, setBrands] = React.useState<DBBrand[]>(initialBrands);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [hasSlackWorkspace, setHasSlackWorkspace] = React.useState<
    boolean | null
  >(null);

  React.useEffect(() => {
    async function checkSlackConnection() {
      try {
        const workspace = await getConnectedSlackWorkspace();
        setHasSlackWorkspace(!!workspace);
      } catch (error) {
        console.error("Error checking Slack connection:", error);
        setHasSlackWorkspace(false);
      }
    }
    checkSlackConnection();
  }, []);

  const handleSave = React.useCallback(
    async (data: { name: string; website: string }) => {
      if (!hasSlackWorkspace) {
        toast.error("Please connect to Slack before creating a brand");
        return;
      }

      try {
        const result = await createBrand(data);
        setBrands((prev) => [...prev, result.brand]);
        window.open(result.integrationsUrl, "_blank");
        toast.success(
          "Brand created successfully! Please complete the integrations setup in the new tab."
        );
      } catch (error) {
        console.error("Error creating brand:", error);
        toast.error("Failed to create brand. Please try again.");
      }
    },
    [hasSlackWorkspace]
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Brands</h1>
        {!hasSlackWorkspace ? (
          <Button asChild>
            <a href="https://lighthouse-slackbot.up.railway.app/slack/install">
              <Slack className="mr-2 h-4 w-4" />
              Connect to Slack
            </a>
          </Button>
        ) : (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Brand
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand) => (
          <BrandCard
            key={brand.id}
            brand={{
              id: brand.id,
              name: brand.name,
              website: brand.website,
              connected: !!brand.tripleWhaleAccessToken,
            }}
          />
        ))}
        {brands.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground">
            {hasSlackWorkspace ? (
              <>
                <p>No brands yet.</p>
                <p>Click &quot;Add Brand&quot; to create your first brand.</p>
              </>
            ) : (
              <>
                <p>Connect to Slack to start creating brands.</p>
                <p>
                  This allows you to manage your brands through Slack as well.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <AddBrandModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
