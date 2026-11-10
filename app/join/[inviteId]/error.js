"use client";

import { useParams } from "next/navigation";

export default function JoinError({ reset }) {
  const params = useParams();
  const inviteId = typeof params?.inviteId === "string" ? params.inviteId : "";
  return (
    <div className="onboard">
      <section className="onboard-card">
        <h1>Something went wrong</h1>
        <p>This step didn't finish loading. You can try it again, or continue to the board.</p>
        <div className="onboard-actions">
          <button className="btn" type="button" onClick={() => reset()}>Try again</button>
          {inviteId ? <a className="btn btn-skip" href={`/join/${inviteId}/github`}>Continue setup</a> : null}
          <a className="btn btn-skip" href="/">Go to the board</a>
        </div>
      </section>
    </div>
  );
}
