"use client";

type Props = {
  onStartFresh: () => void;
  onViewPrevious: () => void;
};

export default function ModeChoice({ onStartFresh, onViewPrevious }: Props) {
  return (
    <div className="assignment-container">
      <div className="restart-container" style={{ display: "block" }}>
        <h3>📊 У вас есть предыдущий результат</h3>
        <p>Вы можете просмотреть свои прошлые ответы или начать заново с чистыми полями</p>
        <div>
          <button className="restart-btn" onClick={onStartFresh} type="button">
            Начать заново
          </button>
          <button className="btn secondary" onClick={onViewPrevious} type="button">
            Просмотреть прошлые ответы
          </button>
        </div>
      </div>
    </div>
  );
}
