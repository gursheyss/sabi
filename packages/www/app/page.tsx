import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="container flex max-w-[64rem] flex-col items-center gap-4 text-center">
        <h1 className="font-geist-sans text-4xl font-bold sm:text-5xl md:text-6xl lg:text-7xl">
          Welcome to Sabi
        </h1>
        <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
          Your analytics platform for better insights and data-driven decisions
        </p>
        <div className="space-x-4">
          <Button asChild size="lg" className="mt-4">
            <Link href="/my-brands">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
