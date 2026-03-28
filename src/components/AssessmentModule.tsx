"use client";

import { useState, useEffect } from "react";
import { Task, taskService, AssessmentQuestion } from "@/lib/taskService";
import { planService } from "@/lib/planService";
import { useAlert } from "@/lib/AlertContext";
import { Clock, CheckCircle2, XCircle, ArrowRight, Save, Star, AlertTriangle, ClipboardSignature } from "lucide-react";
import confetti from "canvas-confetti";

interface Props {
  task: Task;
  onFinish: () => void;
}

type Mode = "INTRO" | "WIZARD" | "RESULTS";

export function AssessmentModule({ task, onFinish }: Props) {
  const { showAlert } = useAlert();
  
  const questions: AssessmentQuestion[] = task.metadata?.questions || [];
  const timeLimit = task.metadata?.assessment_time_limit || 0;

  const [mode, setMode] = useState<Mode>("INTRO");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>(new Array(questions.length).fill(-1));
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  // Temporizador Global
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (mode === "WIZARD" && timeLimit > 0 && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [mode, timeLimit, timeLeft]);

  const handleTimeUp = () => {
    showAlert("¡Se acabó el tiempo!", { type: "info" });
    calculateAndSubmit();
  };

  const calculateAndSubmit = async () => {
    setIsSubmitting(true);
    let correctCount = 0;
    answers.forEach((ans, idx) => {
      if (ans === questions[idx].correctIndex) correctCount++;
    });

    // Calcular nota del 1.0 al 7.0
    const rawRatio = questions.length > 0 ? (correctCount / questions.length) : 0;
    const score = 1.0 + (6.0 * rawRatio);
    const roundedScore = Math.round(score * 10) / 10;
    setFinalScore(roundedScore);

    try {
      if (task.metadata?.is_plan_task) {
        await planService.updateTareaPlanificada(task.id, {
          estado: "completada",
          metadata: {
            ...task.metadata,
            assessment_score_latam: roundedScore,
            assessment_answers: answers
          }
        });
      } else {
        await taskService.updateTask(task.id, {
          status: "completed",
          score: Math.round(100 * rawRatio), 
          metadata: {
            ...task.metadata,
            assessment_score_latam: roundedScore,
            assessment_answers: answers
          }
        });
      }

      if (rawRatio > 0.5) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      }

      setMode("RESULTS");
    } catch (err) {
      console.error(err);
      showAlert("Error guardando tus resultados", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (answers[currentIdx] === -1) {
      return showAlert("Debes seleccionar una opción para avanzar.", { type: "info" });
    }
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      calculateAndSubmit();
    }
  };

  const handleSelectOption = (oIdx: number) => {
    const newA = [...answers];
    newA[currentIdx] = oIdx;
    setAnswers(newA);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!questions || questions.length === 0) {
    return (
      <div className="p-8 text-center text-red-500 font-bold">
        Error: Esta evaluación no tiene preguntas configuradas.
        <button onClick={onFinish} className="block mx-auto mt-4 underline text-gray-500">Volver</button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto min-h-[500px] flex flex-col justify-center animate-in fade-in duration-500">
      
      {mode === "INTRO" && (
        <div className="bg-white rounded-[3rem] p-12 text-center shadow-2xl border-4 border-purple-50">
          <div className="w-24 h-24 mx-auto bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-6">
            <ClipboardSignature size={48} />
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-4">{task.title}</h1>
          <p className="text-xl text-gray-500 mb-8">{task.description || "Lee bien cada pregunta y selecciona la mejor respuesta."}</p>
          
          <div className="flex justify-center gap-6 mb-10">
            <div className="bg-gray-50 rounded-2xl p-4 min-w-[120px]">
              <div className="text-3xl font-black text-purple-600">{questions.length}</div>
              <div className="text-sm font-bold text-gray-400 uppercase">Preguntas</div>
            </div>
            {timeLimit > 0 && (
              <div className="bg-amber-50 rounded-2xl p-4 min-w-[120px]">
                <div className="text-3xl font-black text-amber-600">{Math.floor(timeLimit / 60)}</div>
                <div className="text-sm font-bold text-amber-400 uppercase">Minutos</div>
              </div>
            )}
          </div>

          <button 
            onClick={() => setMode("WIZARD")}
            className="w-full md:w-auto px-16 py-6 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-black text-2xl shadow-xl active:scale-95 transition-all"
          >
            ¡Empezar Prueba!
          </button>
        </div>
      )}

      {mode === "WIZARD" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center px-4">
            <div className="font-bold text-purple-600 bg-purple-100 px-4 py-2 rounded-full">
              Pregunta {currentIdx + 1} de {questions.length}
            </div>
            {timeLimit > 0 && (
              <div className={`font-black flex items-center gap-2 px-4 py-2 rounded-full ${timeLeft <= 60 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-600'}`}>
                <Clock size={18} /> {formatTime(timeLeft)}
              </div>
            )}
          </div>

          <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl border-4 border-purple-50 transition-all">
            <h2 className="text-3xl font-black text-gray-800 leading-tight mb-8">
              {questions[currentIdx].text}
            </h2>

            <div className="space-y-4">
              {questions[currentIdx].options.map((opt, oIdx) => {
                const isSelected = answers[currentIdx] === oIdx;
                return (
                 <button
                   key={oIdx}
                   onClick={() => handleSelectOption(oIdx)}
                   className={`w-full p-6 rounded-2xl border-4 text-left transition-all ${
                     isSelected 
                      ? "border-purple-500 bg-purple-50 shadow-md ring-4 ring-purple-100 scale-[1.02]" 
                      : "border-gray-100 hover:border-purple-200 hover:bg-gray-50"
                   }`}
                 >
                   <div className="flex items-center gap-4">
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${isSelected ? "border-purple-600 bg-purple-600" : "border-gray-300"}`}>
                       {isSelected && <div className="w-3 h-3 bg-white rounded-full" />}
                     </div>
                     <span className={`text-xl font-bold ${isSelected ? "text-purple-900" : "text-gray-700"}`}>
                       {opt}
                     </span>
                   </div>
                 </button>
                )
              })}
            </div>

            <div className="mt-12 flex justify-end">
              <button
                onClick={handleNext}
                disabled={isSubmitting}
                className="px-10 py-5 bg-gray-900 hover:bg-black text-white rounded-full font-black text-xl flex items-center gap-3 active:scale-95 disabled:opacity-50 transition-all shadow-lg"
              >
                {isSubmitting ? "Guardando..." : currentIdx === questions.length - 1 ? "Terminar Evaluación" : "Siguiente"} 
                {!isSubmitting && <ArrowRight />}
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === "RESULTS" && (
        <div className="space-y-6">
          <div className="bg-white rounded-[3rem] p-12 text-center shadow-2xl border-4 border-emerald-50 relative overflow-hidden">
            <div className="text-emerald-500 flex justify-center mb-4">
              <Star fill="currentColor" size={64} />
            </div>
            <h1 className="text-4xl font-black text-gray-900 mb-2">Evaluación Finalizada</h1>
            <p className="text-gray-500 font-bold mb-8">¡El tutor revisará tus resultados!</p>
            
            <div className="inline-block bg-emerald-50 border-4 border-emerald-100 rounded-[2rem] p-8 mb-8">
               <div className="text-sm font-black text-emerald-600 uppercase tracking-widest mb-2">Nota Final</div>
               <div className="text-7xl font-black text-emerald-600">{finalScore.toFixed(1)}</div>
            </div>

            <button 
              onClick={onFinish}
              className="w-full md:w-auto px-16 py-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-black text-2xl shadow-xl active:scale-95 transition-all"
            >
              Volver al Menú
            </button>
          </div>

          {/* Justificaciones / Review para el niño */}
          <div className="space-y-4">
            <h3 className="text-xl font-black text-gray-400 uppercase tracking-widest pl-4">Repaso de lo aprendido</h3>
            {questions.map((q, idx) => {
              const isCorrect = answers[idx] === q.correctIndex;
              return (
                <div key={idx} className={`p-6 rounded-2xl border-l-[8px] bg-white shadow-sm ${isCorrect ? 'border-l-emerald-400' : 'border-l-amber-400'}`}>
                  <h4 className="font-bold text-gray-800 text-lg mb-2">{idx + 1}. {q.text}</h4>
                  
                  <div className="flex items-start gap-4 mb-3">
                    {isCorrect ? <CheckCircle2 className="text-emerald-500 shrink-0 mt-1" /> : <XCircle className="text-amber-500 shrink-0 mt-1" />}
                    <div>
                      <span className={`font-black text-sm uppercase ${isCorrect ? 'text-emerald-600' : 'text-amber-600'}`}>Tu respuesta:</span>
                      <p className="text-gray-600 font-medium">{q.options[answers[idx]] || "No respondida"}</p>
                    </div>
                  </div>

                  {!isCorrect && (
                    <div className="pl-10 mb-3">
                      <span className="font-black text-sm uppercase text-emerald-600 block">Respuesta correcta:</span>
                      <p className="text-gray-600 font-medium">{q.options[q.correctIndex]}</p>
                    </div>
                  )}

                  <div className="mt-4 p-4 bg-gray-50 rounded-xl text-gray-700 font-bold text-sm italic border-2 border-gray-100">
                    💡 {q.explanation}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
