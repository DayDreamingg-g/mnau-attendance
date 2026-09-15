import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { loginErrorMessage } from "@/lib/login-errors";
import { demoEnabled } from "@/lib/time";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

export default async function Login({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;
  const error = loginErrorMessage(params.error);
  const isDemo = demoEnabled();

  return (
    <main className="login-page">
      <div className="login-theme">
        <ThemeToggle />
      </div>

      <div className="login-card">
        <div className="brand">
          <span className="brand-mark">М</span>

          <span>
            MNAU
            <span className="brand-sub">
              ATTENDANCE
            </span>
          </span>
        </div>

        <div className="login-heading">
          <div className="flex items-center justify-between gap-4">
            <p className="eyebrow">
              ЕЛЕКТРОННИЙ ЖУРНАЛ
            </p>

            {isDemo && (
              <span className="outline-badge shrink-0">
                TEST
              </span>
            )}
          </div>

          <h1>Раді бачити вас</h1>

          <p className="muted">
            Увійдіть, щоб відкрити заняття та
            відвідуваність.
          </p>
        </div>

        <LoginForm
          key={error}
          initialError={error}
        />

        <p className="login-footer">
          Миколаївський національний аграрний
          університет
          <br />
          Експериментальний проєкт
        </p>
      </div>
    </main>
  );
}