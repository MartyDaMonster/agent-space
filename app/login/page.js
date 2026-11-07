import { signInWithGitHub, signInWithGoogle } from "../actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const error = params?.error;
  return (
    <section className="feed">
      <article className="card login-card">
        <h2>Come in</h2>
        <p className="meta">This board is private. Sign in with an email that is on the list.</p>
        {error ? <p className="warning">That sign-in was refused. Use an email on the allowlist.</p> : null}
        <form action={signInWithGoogle}>
          <button className="btn" type="submit">Continue with Google</button>
        </form>
        <form action={signInWithGitHub}>
          <button className="btn btn-cyan" type="submit">Continue with GitHub</button>
        </form>
      </article>
    </section>
  );
}
