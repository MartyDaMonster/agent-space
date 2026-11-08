import { PlatformRow } from "@/components/PlatformRow";
import { Wordmark } from "@/components/Wordmark";
import { signInWithGitHub, signInWithGoogle } from "../actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const error = params?.error;
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
