type Props = {
  text?: string;
  style?: React.CSSProperties;
};

export default function LoadingBlock({ text = "Загружаем...", style }: Props) {
  return (
    <div className="loading" style={{ display: "block", ...style }}>
      <div className="spinner" />
      <p>{text}</p>
    </div>
  );
}
