/**
 * lazy_loading_imagenes.tsx
 * Lógica Frontend recomendada para Carga Asíncrona en Next.js/React
 * ÉPICA 3: Rendimiento y Almacenamiento
 */

import React, { useState } from 'react';
/* 
  En Next.js se sugiere usar el componente Image de "next/image" ya que
  incluye "lazy" nativo y compresión automática si se configura correctamente a Formato WebP. 
  Aquí demostramos la técnica con soporte visual UX en caso de una red lenta.
*/
// import Image from 'next/image';

interface Task {
  id: string;
  title: string;
  image_url: string;
}

// -----------------------------------------------------------------------
// 1. COMPONENTE IMAGEN DIFERIDA CON SKELETON
// -----------------------------------------------------------------------
export const AsyncImageWithSkeleton = ({ src, alt }: { src: string, alt: string }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="relative w-full h-48 bg-gray-100 rounded-xl overflow-hidden shadow-sm">
      {/* Skeleton (Placeholder visible mientras carga) */}
      {!isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-indigo-50 flex items-center justify-center">
            {/* Opcional: Icono amigable o logo en color pastel difuminado */}
            <span className="text-indigo-200">Cargando...</span>
        </div>
      )}

      {/* Imagen Asíncrona */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-700 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};

// -----------------------------------------------------------------------
// 2. VISTA DE LISTADO (UX sin bloqueos cognitivos)
// -----------------------------------------------------------------------
export const TaskList = ({ tasks }: { tasks: Task[] }) => {
  /*
    Regla Crítica:
    El esqueleto DOM principal (tarjeta, título, botones) se dibuja Inmediatamente. 
    Esto evita que el alumno se frustre viendo hojas en blanco en el Dashboard.
  */
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
      {tasks.length === 0 ? (
        <div className="col-span-full py-10 text-center text-gray-400 font-bold">
          ¡Aún no hay tareas! El tutor preparará algo pronto.
        </div>
      ) : (
        tasks.map((task) => (
          <article 
            key={task.id} 
            className="group block bg-white border-2 border-transparent hover:border-indigo-300 rounded-2xl overflow-hidden shadow-md transition-all active:scale-[0.98]"
          >
            {/* Imagen Pesa más -> Lazy Load integrado */}
            <AsyncImageWithSkeleton src={task.image_url} alt={task.title} />

            <div className="p-4">
              <h3 className="text-xl font-black text-gray-800 line-clamp-2">
                {task.title}
              </h3>
              
              <button 
                className="mt-6 w-full py-3 bg-emerald-500 text-white rounded-xl font-black hover:bg-emerald-600 transition-colors"
                onClick={() => alert(`Iniciando Tarea: ${task.id}`)}
              >
                Comenzar Actividad
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );
};
