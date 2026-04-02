"use client";

import { useState, useEffect } from "react";
import { Task, taskService } from "@/lib/taskService";
import { stemService } from "@/lib/stemService";
import { Loader2, ArrowLeft, CheckCircle2, ChevronRight, FlaskConical, Triangle, Calculator } from "lucide-react";
import parse from "html-react-parser";
import { useAlert } from "@/lib/AlertContext";

interface Props {
  task: Task;
  onBack: () => void;
}

export function StemModule({ task, onBack }: Props) {
  const { showAlert } = useAlert();
  const [stemItem, setStemItem] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<"intro" | "lesson" | "quiz" | "finished">("intro");
  
  // Quiz state
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    async function load() {
      if (task.metadata?.stem_item_id) {
        try {
          const item = await stemService.getKnowledgeBaseItem(task.metadata.stem_item_id);
          setStemItem(item);
        } catch (e) {
          console.error(e);
        }
      }
      setIsLoading(false);
    }
    load();
  }, [task]);

  const questions = stemItem?.metadata?.questions || [];

  const handleStart = () => {
    if (stemItem?.content_html) {
      setStep("lesson");
    } else if (questions.length > 0) {
      setStep("quiz");
    } else {
      setStep("finished");
    }
  };

  const handleLessonNext = () => {
    if (questions.length > 0) {
      setStep("quiz");
    } else {
      finishModule();
    }
  };

  const handleAnswerSubmit = () => {
    if (selectedAnswer === null) return;
    setShowFeedback(true);
    if (selectedAnswer === questions[currentQIndex].correctIndex) {
      setScore(s => s + 1);
    }
  };

  const handleNextQuestion = () => {
    setShowFeedback(false);
    setSelectedAnswer(null);
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
    } else {
      finishModule();
    }
  };

  const finishModule = async () => {
    setStep("finished");
    const finalScore = questions.length > 0 ? Math.round((score / questions.length) * 100) : 100;
    
    try {
      if (task.id) {
        await taskService.updateTask(task.id, {
          status: "completed",
          score: finalScore
        });
      }
    } catch (e) {
      showAlert("Hubo un error al guardar tu progreso.", { type: "error" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="animate-spin text-cyan-500" size={48} />
        <p className="text-gray-500 font-bold">Cargando módulo de exploración...</p>
      </div>
    );
  }

  if (!stemItem) {
    return (
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl text-center">
        <p className="text-gray-500 font-bold mb-4">No pudimos cargar el contenido de esta lección.</p>
        <button onClick={onBack} className="px-6 py-2 bg-gray-100 rounded-xl font-bold">Volver</button>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl border-4 border-cyan-50 max-w-4xl mx-auto min-h-[60vh] flex flex-col relative text-gray-800">
      <button 
        onClick={onBack}
        className="absolute top-6 left-6 p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full transition-colors z-10"
      >
        <ArrowLeft size={24} />
      </button>

      {/* HEADER TEMA */}
      <div className="text-center mb-8 pt-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-100 text-cyan-600 rounded-3xl mb-4 shadow-inner">
          {stemItem.category === 'math' ? <Calculator size={32} /> : 
           stemItem.category === 'geometry' ? <Triangle size={32} /> : <FlaskConical size={32} />}
        </div>
        <h2 className="text-3xl font-black text-gray-900">{stemItem.title}</h2>
        <span className="uppercase tracking-widest font-black text-cyan-500 text-xs shadow-sm bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 mt-2 inline-block">
          {stemItem.category === 'math' ? 'Matemática' : stemItem.category === 'geometry' ? 'Geometría' : 'Ciencias'}
        </span>
      </div>

      {step === "intro" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
          <p className="text-xl text-gray-600 mb-8 max-w-lg">
            ¡Prepárate para explorar y aprender algo nuevo! ¿Listo para empezar la aventura?
          </p>
          <button 
            onClick={handleStart}
            className="px-10 py-5 bg-cyan-500 text-white font-black text-2xl rounded-full shadow-lg hover:bg-cyan-600 hover:scale-105 transition-all"
          >
            ¡Empezar a Explorar!
          </button>
        </div>
      )}

      {step === "lesson" && (
        <div className="flex-1 flex flex-col animate-in slide-in-from-right-4 duration-500 overflow-visible">
          
          <div className="prose prose-cyan prose-lg max-w-none text-gray-700 bg-cyan-50/20 p-8 rounded-3xl border-2 border-cyan-100">
            {parse(stemItem.content_html)}
          </div>

          <div className="mt-8 flex justify-end">
            <button 
              onClick={handleLessonNext}
              className="px-8 py-4 bg-cyan-500 text-white font-black text-xl rounded-2xl shadow-md hover:bg-cyan-600 flex items-center gap-2"
            >
              {questions.length > 0 ? "Ir a las preguntas" : "Finalizar Módulo"} <ChevronRight />
            </button>
          </div>
        </div>
      )}

      {step === "quiz" && questions.length > 0 && (
        <div className="flex-1 flex flex-col justify-center animate-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto w-full">
          <p className="text-sm font-black text-cyan-400 uppercase tracking-widest mb-2 text-center">
            Pregunta {currentQIndex + 1} de {questions.length}
          </p>
          <h3 className="text-2xl font-black text-gray-900 mb-8 text-center">{questions[currentQIndex].text}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questions[currentQIndex].options.map((opt: string, idx: number) => {
              const isSelected = selectedAnswer === idx;
              const isCorrect = idx === questions[currentQIndex].correctIndex;
              let styleCls = "bg-white border-gray-200 text-gray-700 hover:border-cyan-400 hover:bg-cyan-50";
              
              if (showFeedback) {
                if (isCorrect) styleCls = "bg-emerald-100 border-emerald-400 text-emerald-800 scale-105 opacity-100";
                else if (isSelected) styleCls = "bg-red-50 border-red-200 text-red-600 opacity-50";
                else styleCls = "bg-white border-gray-100 text-gray-400 opacity-50";
              } else if (isSelected) {
                styleCls = "bg-cyan-100 border-cyan-400 text-cyan-800 ring-2 ring-cyan-200";
              }

              return (
                <button
                  key={idx}
                  disabled={showFeedback}
                  onClick={() => setSelectedAnswer(idx)}
                  className={`p-6 rounded-2xl border-4 font-black transition-all text-lg ${styleCls}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col items-center min-h-[100px]">
            {!showFeedback ? (
              <button
                disabled={selectedAnswer === null}
                onClick={handleAnswerSubmit}
                className="px-10 py-4 bg-gray-900 text-white font-black text-lg rounded-2xl disabled:opacity-30 transition-opacity"
              >
                Revisar Respuesta
              </button>
            ) : (
              <div className="w-full text-center animate-in fade-in zoom-in-95">
                <p className={`font-bold mb-4 ${selectedAnswer === questions[currentQIndex].correctIndex ? 'text-emerald-500' : 'text-red-500'}`}>
                  {selectedAnswer === questions[currentQIndex].correctIndex ? '¡Excelente!' : 'Casi...'} {questions[currentQIndex].explanation}
                </p>
                <button
                  onClick={handleNextQuestion}
                  className="px-10 py-4 bg-cyan-500 text-white font-black text-lg rounded-2xl"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {step === "finished" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in-90 duration-500">
          <div className="w-32 h-32 bg-emerald-100 text-emerald-500 rounded-[3rem] flex items-center justify-center shadow-inner mb-6 relative">
            <CheckCircle2 size={64} className="drop-shadow-sm" />
            <div className="absolute top-0 w-full h-full border-4 border-emerald-400 rounded-[3rem] animate-ping opacity-20"></div>
          </div>
          <h2 className="text-4xl font-black text-gray-900 mb-2">¡Misión Cumplida!</h2>
          <p className="text-xl text-gray-500 font-medium mb-8">Has completado tu exploración en {stemItem.category === 'math' ? 'Matemática' : stemItem.category === 'geometry' ? 'Geometría' : 'Ciencias'}.</p>
          <button 
            onClick={onBack}
            className="px-8 py-4 bg-gray-900 text-white font-black text-lg rounded-2xl shadow-xl hover:bg-gray-800 transition-all hover:scale-105"
          >
            Regresar a Aventuras
          </button>
        </div>
      )}
    </div>
  );
}
