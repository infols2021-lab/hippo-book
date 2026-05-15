export const formatSize = (bytes: number) => {
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

export const processImages = async (files: File[], quality: number) => {
  if (files.length === 0) return;
  
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  formData.append('quality', quality.toString());

  try {
    const response = await fetch('/api/optimize', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Ошибка при сжатии сервером');

    // Получаем архив в виде бинарных данных
    const blob = await response.blob();
    
    // Создаем ссылку и триггерим скачивание файла
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'optimized_images.zip';
    document.body.appendChild(a);
    a.click();
    
    // Очищаем память браузера от ссылки
    window.URL.revokeObjectURL(url);
    a.remove();
  } catch (error) {
    console.error('Ошибка на клиенте:', error);
    alert('Произошла ошибка при обработке изображений. Проверь консоль.');
  }
};