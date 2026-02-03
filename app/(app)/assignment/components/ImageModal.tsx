"use client";

type Props = {
  open: boolean;
  src: string;
  zoom: number;
  setZoom: (z: number) => void;
  onClose: () => void;
};

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

export default function ImageModal({ open, src, zoom, setZoom, onClose }: Props) {
  return (
    <div
      id="imageModal"
      className="image-modal"
      style={{ display: open ? "block" : "none" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <span className="image-modal-close" onClick={onClose}>
        &times;
      </span>

      <img className="image-modal-content" id="modalImage" src={src} alt="" style={{ transform: `translate(-50%, -50%) scale(${zoom})` }} />

      <div className="image-modal-controls">
        <button className="image-modal-btn" onClick={() => setZoom(Math.max(MIN_ZOOM, +(zoom - ZOOM_STEP).toFixed(2)))} type="button">
          −
        </button>

        <div className="image-modal-zoom-info">{Math.round(zoom * 100)}%</div>

        <button className="image-modal-btn" onClick={() => setZoom(Math.min(MAX_ZOOM, +(zoom + ZOOM_STEP).toFixed(2)))} type="button">
          +
        </button>

        <button className="image-modal-btn" onClick={() => setZoom(1)} type="button">
          ⟲
        </button>
      </div>

      <div className="image-modal-hint" style={{ display: zoom > 1 ? "block" : "none" }}>
        🔍 Масштабирование
      </div>
    </div>
  );
}
