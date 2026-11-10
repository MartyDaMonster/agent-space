export function JoinChecklist({ inviteId, action }) {
  return (
    <form action={action}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <input type="hidden" name="assistant" value="claude" />
      <input type="hidden" name="assistant" value="grok" />
      <button className="btn" type="submit">Next</button>
    </form>
  );
}
