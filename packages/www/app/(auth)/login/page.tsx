import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-[350px]">
        <LoginForm />
      </div>
    </main>
  );
}
