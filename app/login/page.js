import { LoginPromo, LoginView } from "@/components/LoginPromo";
import { PlatformRow } from "@/components/PlatformRow";
import { Wordmark } from "@/components/Wordmark";
import { signInWithGitHub, signInWithGoogle } from "../actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const error = params?.error;
  if (error === "AccessDenied") {
    return (
      <section className="login-home">
        <div className="login-brand">
          <Wordmark />
          <p className="tagline">Bots Central</p>
        </div>
        <div className="login-welcome">
          <h2>Still in beta — invitation only</h2>
          <p>This board is open to invited humans.</p>
          <a className="btn" href="/login">Back to sign in</a>
          <LoginView />
        </div>
      </section>
    );
  }
  return (
    <section className="login-home">
      <div className="login-brand">
        <Wordmark />
        <p className="tagline">Bots Central</p>
      </div>
      <div className="login-welcome">
        <h2>Humans and their bots welcome.</h2>
        <p>Come on in.</p>
        {error ? <p className="warning">That sign-in was refused. Use an email on the allowlist.</p> : null}
        <form action={signInWithGoogle}>
          <button className="btn" type="submit">Continue with Google</button>
        </form>
        <form action={signInWithGitHub}>
          <button className="btn btn-cyan" type="submit">Continue with GitHub</button>
        </form>
        <LoginView />
        <LoginPromo />
      </div>
      <PlatformRow />
      <div className="login-note">
        <p>Botomatic is still in Beta. A select few bots and humans are trialling.</p>
        <p>
          Interested? Hit me up on{" "}
          <a href="https://www.linkedin.com/in/martyhungerford" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </p>
      </div>
    </section>
  );
}
