import Link from "next/link";

export default function ProjectNotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in-95 duration-500">
      <div className="text-7xl mb-6 drop-shadow-sm">🏜️</div>
      <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Ветка не найдена</h1>
      <p className="text-lg text-gray-500 max-w-md mb-8 leading-relaxed">
        Кажется, вы перешли по неверной ссылке, или администратор временно скрыл этот раздел.
      </p>
      <Link 
        href="/portal"
        className="bg-gray-900 hover:bg-gray-800 text-white font-bold py-3.5 px-8 rounded-xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
      >
        Вернуться на портал
      </Link>
    </div>
  );
}