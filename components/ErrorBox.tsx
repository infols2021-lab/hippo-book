"use client";

type Props = {
  message: string;

  // старые пропсы (чтобы не падало в других местах)
  retryMode?: "reload" | "link" | "none";
  retryHref?: string;
  retryLabel?: string;

  // новый быстрый retry (например load() в табах)
  retry?: () => void;
};

export default function ErrorBox({
  message,
  retryMode = "reload",
  retryHref = "",
  retryLabel = "🔄 Повторить",
  retry,
}: Props) {
  function doRetry() {
    if (retry) return retry();
    if (retryMode === "reload") return location.reload();
    // link/none обрабатываем в JSX ниже
  }

  return (
    <div className="error" style={{ display: "block" }}>
      ❌ {message}
      <div style={{ height: 10 }} />

      {retry ? (
        <button className="btn" onClick={doRetry} type="button">
          {retryLabel}
        </button>
      ) : retryMode === "reload" ? (
        <button className="btn" onClick={doRetry} type="button">
          {retryLabel}
        </button>
      ) : retryMode === "link" ? (
        <a className="btn" href={retryHref}>
          {retryLabel}
        </a>
      ) : null}
    </div>
  );
}
