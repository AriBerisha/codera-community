import { LoginForm } from "./login-form";
import { ssoEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm ssoEnabled={ssoEnabled} />;
}
