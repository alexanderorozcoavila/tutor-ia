export interface Exercise {
  id: string;
  type: "reading" | "writing";
  word: string;
  instruction: string;
  category: string;
}

export const INITIAL_EXERCISES: Exercise[] = [
  {
    id: "1",
    type: "reading",
    word: "Sol",
    instruction: "Mira la palabra en la pantalla y léela en voz alta.",
    category: "Naturaleza",
  },
  {
    id: "2",
    type: "writing",
    word: "Casa",
    instruction: "Escribe la palabra 'Casa' en tu cuaderno y muéstrala a la cámara.",
    category: "Hogar",
  },
  {
    id: "3",
    type: "reading",
    word: "Perro",
    instruction: "¡Qué bien! Ahora, ¿puedes leer esta palabra?",
    category: "Animales",
  },
  {
    id: "4",
    type: "writing",
    word: "Luna",
    instruction: "Dibuja o escribe la palabra 'Luna' y saca una foto.",
    category: "Espacio",
  },
];
