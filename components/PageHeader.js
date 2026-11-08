export function PageHeader({ title, lede }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {lede ? <p>{lede}</p> : null}
    </header>
  );
}
