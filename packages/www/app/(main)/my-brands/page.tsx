import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MyBrandsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <Button>
          <Plus />
          Add New Brand
        </Button>
      </div>
    </div>
  );
}
