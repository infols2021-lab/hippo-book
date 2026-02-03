type Props = {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
};

export default function PageCard({ title, subtitle, children }: Props) {
  return (
    <div className="container">
      <div className="card">
        {title ? <h2>{title}</h2> : null}
        {subtitle ? <p className="small-muted">{subtitle}</p> : null}
        {children}
      </div>
    </div>
  );
}
