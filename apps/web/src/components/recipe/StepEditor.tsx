import { useState, useEffect } from 'react';
import { IconX, IconPlus, IconTrash } from '@tabler/icons-react';
import type { RecipeStep } from '@pixel-mentor/shared';

import { Button, Input, Textarea } from '@/components/ui';
import { useAudio } from '@/contexts/AudioContext';

type StepType = 'content' | 'activity' | 'question' | 'intro' | 'closure';

// Helper to extract text from string or {text: string} object
function extractText(val: unknown): string {
  if (typeof val === 'string') return val;
  if (
    val &&
    typeof val === 'object' &&
    'text' in val &&
    typeof (val as { text: unknown }).text === 'string'
  ) {
    return (val as { text: string }).text;
  }
  return '';
}

interface StepEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (stepData: {
    order: number;
    stepType: StepType;
    script?: Record<string, unknown>;
    activity?: Record<string, unknown>;
    question?: Record<string, unknown>;
  }) => void;
  step?: RecipeStep;
  order: number;
}

const STEP_TYPE_OPTIONS: { value: StepType; label: string }[] = [
  { value: 'content', label: 'Contenido' },
  { value: 'activity', label: 'Actividad' },
  { value: 'question', label: 'Pregunta' },
  { value: 'intro', label: 'Introducción' },
  { value: 'closure', label: 'Cierre' },
];

export function StepEditor({
  isOpen,
  onClose,
  onSave,
  step,
  order: initialOrder,
}: StepEditorProps) {
  const { playClick } = useAudio();

  const [stepType, setStepType] = useState<StepType>('content');
  const [stepOrder, setStepOrder] = useState<number>(1);
  const [scriptTransition, setScriptTransition] = useState('');
  const [scriptContent, setScriptContent] = useState('');
  const [scriptExamples, setScriptExamples] = useState<string[]>(['']);
  const [scriptClosure, setScriptClosure] = useState('');

  // Activity fields
  const [activityTransition, setActivityTransition] = useState('');
  const [activityInstruction, setActivityInstruction] = useState('');
  const [activityOptions, setActivityOptions] = useState<{ text: string; isCorrect: boolean }[]>([
    { text: '', isCorrect: false },
  ]);
  const [activityFeedbackCorrect, setActivityFeedbackCorrect] = useState('');
  const [activityFeedbackIncorrect, setActivityFeedbackIncorrect] = useState('');

  // Question fields
  const [questionText, setQuestionText] = useState('');
  const [questionExpectedAnswer, setQuestionExpectedAnswer] = useState('');
  const [questionFeedbackCorrect, setQuestionFeedbackCorrect] = useState('');
  const [questionFeedbackIncorrect, setQuestionFeedbackIncorrect] = useState('');
  const [questionHint, setQuestionHint] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (step) {
      setStepType((step as unknown as { stepType?: StepType }).stepType || 'content');
      setStepOrder((step as unknown as { order?: number }).order ?? 1);

      // Parse the script field - it could be a content script or activity/question script
      const scriptData = step.script as Record<string, unknown> | undefined;

      if (scriptData) {
        // Check if it's an activity or question script (has 'kind' field)
        const kind = scriptData.kind as string | undefined;

        if (kind === 'activity') {
          // Load activity fields
          setActivityTransition(extractText(scriptData.transition));
          setActivityInstruction(extractText(scriptData.instruction));
          const options = (scriptData.options as Array<{ text: string; isCorrect: boolean }>) || [];
          setActivityOptions(options.length > 0 ? options : [{ text: '', isCorrect: false }]);
          const feedback = (scriptData.feedback as Record<string, string>) || {};
          setActivityFeedbackCorrect(feedback.correct || '');
          setActivityFeedbackIncorrect(feedback.incorrect || '');
        } else if (kind === 'question') {
          // Load question fields
          setQuestionText(extractText(scriptData.question));
          setQuestionExpectedAnswer((scriptData.expectedAnswer as string) || '');
          const feedback = (scriptData.feedback as Record<string, string>) || {};
          setQuestionFeedbackCorrect(feedback.correct || '');
          setQuestionFeedbackIncorrect(feedback.incorrect || '');
          setQuestionHint((scriptData.hint as string) || '');
        } else {
          // It's a content/intro/closure script - load content fields
          setScriptTransition(
            typeof scriptData.transition === 'string'
              ? scriptData.transition
              : ((scriptData.transition as Record<string, unknown>)?.text as string) || '',
          );
          setScriptContent(
            typeof scriptData.content === 'string'
              ? scriptData.content
              : ((scriptData.content as Record<string, unknown>)?.text as string) || '',
          );
          const examples = (scriptData.examples as Array<string | Record<string, string>>) || [];
          setScriptExamples(examples.map((e) => (typeof e === 'string' ? e : e.text || '')));
          setScriptClosure(
            typeof scriptData.closure === 'string'
              ? scriptData.closure
              : ((scriptData.closure as Record<string, unknown>)?.text as string) || '',
          );
        }
      }
    } else {
      setStepType('content');
      setStepOrder(initialOrder);
      setScriptTransition('');
      setScriptContent('');
      setScriptExamples(['']);
      setScriptClosure('');
      setActivityTransition('');
      setActivityInstruction('');
      setActivityOptions([{ text: '', isCorrect: false }]);
      setActivityFeedbackCorrect('');
      setActivityFeedbackIncorrect('');
      setQuestionText('');
      setQuestionExpectedAnswer('');
      setQuestionFeedbackCorrect('');
      setQuestionFeedbackIncorrect('');
      setQuestionHint('');
    }
    setErrors({});
  }, [step, isOpen]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepType === 'content') {
      if (!scriptContent.trim()) {
        newErrors.scriptContent = 'El contenido es requerido';
      }
    } else if (stepType === 'activity') {
      if (!activityInstruction.trim()) {
        newErrors.activityInstruction = 'La instrucción es requerida';
      }
      const hasCorrect = activityOptions.some((o) => o.isCorrect);
      if (!hasCorrect) {
        newErrors.activityOptions = 'Debe haber al menos una opción correcta';
      }
    } else if (stepType === 'question') {
      if (!questionText.trim()) {
        newErrors.questionText = 'La pregunta es requerida';
      }
      if (!questionExpectedAnswer.trim()) {
        newErrors.questionExpectedAnswer = 'La respuesta esperada es requerida';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    playClick();

    let script: Record<string, unknown> | undefined;
    let activity: Record<string, unknown> | undefined;
    let question: Record<string, unknown> | undefined;

    if (stepType === 'content') {
      script = {
        transition: scriptTransition,
        content: scriptContent,
        examples: scriptExamples.filter((e) => e.trim()),
        closure: scriptClosure,
      };
    } else if (stepType === 'intro' || stepType === 'closure') {
      script = {
        transition: ' ',
        content: scriptContent,
        examples: [{ text: ' ' }],
        closure: ' ',
      };
    } else if (stepType === 'activity') {
      // Activity is stored in the script field for backend compatibility
      script = {
        kind: 'activity',
        transition: activityTransition,
        instruction: activityInstruction,
        options: activityOptions.filter((o) => o.text.trim()),
        feedback: {
          correct: activityFeedbackCorrect || '¡Correcto!',
          incorrect: activityFeedbackIncorrect || 'Intenta de nuevo',
        },
        closure: '',
      };
    } else if (stepType === 'question') {
      // Question is stored in the script field for backend compatibility
      script = {
        kind: 'question',
        transition: '',
        question: questionText,
        expectedAnswer: questionExpectedAnswer,
        feedback: {
          correct: questionFeedbackCorrect || '¡Muy bien!',
          incorrect: questionFeedbackIncorrect || 'Casi, intentá de nuevo',
        },
        hint: questionHint,
      };
    }

    try {
      await onSave({
        order: stepOrder,
        stepType,
        script,
        activity,
        question,
      });
      onClose();
    } catch {
      // Error already handled by parent (alert). Keep modal open.
    }
  };

  const addExample = () => {
    setScriptExamples([...scriptExamples, '']);
  };

  const removeExample = (index: number) => {
    setScriptExamples(scriptExamples.filter((_, i) => i !== index));
  };

  const updateExample = (index: number, value: string) => {
    const updated = [...scriptExamples];
    updated[index] = value;
    setScriptExamples(updated);
  };

  const addActivityOption = () => {
    setActivityOptions([...activityOptions, { text: '', isCorrect: false }]);
  };

  const removeActivityOption = (index: number) => {
    setActivityOptions(activityOptions.filter((_, i) => i !== index));
  };

  const updateActivityOption = (
    index: number,
    field: 'text' | 'isCorrect',
    value: string | boolean,
  ) => {
    const updated = [...activityOptions];
    if (field === 'isCorrect' && value === true) {
      for (const [i, o] of updated.entries()) {
        o.isCorrect = i === index;
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setActivityOptions(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-4 border-sky-200">
          <h2 className="text-xl font-black text-slate-800">
            {step ? 'Editar Paso' : 'Nuevo Paso'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <IconX className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Step Type */}
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2">Tipo de Paso *</label>
              <select
                value={stepType}
                onChange={(e) => setStepType(e.target.value as StepType)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-base focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                {STEP_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Order (editable) */}
            <div>
              <Input
                type="number"
                label="Orden"
                value={stepOrder.toString()}
                onChange={(e) => setStepOrder(parseInt(e.target.value, 10) || 1)}
                helperText="Posición del paso en la secuencia"
              />
            </div>

            {/* Content Fields */}
            {stepType === 'content' ? (
              <div className="space-y-4">
                <Textarea
                  label="Transición"
                  value={scriptTransition}
                  onChange={(e) => setScriptTransition(e.target.value)}
                  placeholder="Texto de transición antes del contenido..."
                  className="min-h-[80px]"
                />
                <Textarea
                  label="Contenido *"
                  value={scriptContent}
                  onChange={(e) => setScriptContent(e.target.value)}
                  placeholder="Contenido principal del paso..."
                  className="min-h-[120px]"
                  error={errors.scriptContent}
                />
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Ejemplos</label>
                  {scriptExamples.map((example, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <Input
                        value={example}
                        onChange={(e) => updateExample(index, e.target.value)}
                        placeholder={`Ejemplo ${index + 1}`}
                        className="flex-1"
                      />
                      {scriptExamples.length > 1 ? (
                        <button
                          onClick={() => removeExample(index)}
                          className="p-2 text-slate-400 hover:text-rose-500"
                        >
                          <IconTrash className="w-5 h-5" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <button
                    onClick={addExample}
                    className="text-sm text-sky-500 font-medium flex items-center gap-1"
                  >
                    <IconPlus className="w-4 h-4" />
                    Añadir ejemplo
                  </button>
                </div>
                <Textarea
                  label="Cierre"
                  value={scriptClosure}
                  onChange={(e) => setScriptClosure(e.target.value)}
                  placeholder="Texto de cierre..."
                  className="min-h-[80px]"
                />
              </div>
            ) : null}

            {/* Activity Fields */}
            {stepType === 'activity' ? (
              <div className="space-y-4">
                <Textarea
                  label="Transición"
                  value={activityTransition}
                  onChange={(e) => setActivityTransition(e.target.value)}
                  placeholder="Texto de transición antes de la actividad..."
                  className="min-h-[60px]"
                />
                <Textarea
                  label="Instrucción *"
                  value={activityInstruction}
                  onChange={(e) => setActivityInstruction(e.target.value)}
                  placeholder="Describe la actividad..."
                  className="min-h-[80px]"
                  error={errors.activityInstruction}
                />
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Opciones</label>
                  {activityOptions.map((option, index) => (
                    <div key={index} className="flex gap-2 mb-2 items-center">
                      <input
                        type="checkbox"
                        checked={option.isCorrect}
                        onChange={(e) => updateActivityOption(index, 'isCorrect', e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                      />
                      <Input
                        value={option.text}
                        onChange={(e) => updateActivityOption(index, 'text', e.target.value)}
                        placeholder={`Opción ${index + 1}`}
                        className="flex-1"
                      />
                      {activityOptions.length > 1 ? (
                        <button
                          onClick={() => removeActivityOption(index)}
                          className="p-2 text-slate-400 hover:text-rose-500"
                        >
                          <IconTrash className="w-5 h-5" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {errors.activityOptions ? (
                    <p className="text-sm text-red-500 mt-1">{errors.activityOptions}</p>
                  ) : null}
                  <button
                    onClick={addActivityOption}
                    className="text-sm text-sky-500 font-medium flex items-center gap-1 mt-2"
                  >
                    <IconPlus className="w-4 h-4" />
                    Añadir opción
                  </button>
                </div>
                <Input
                  label="Feedback Correcto"
                  value={activityFeedbackCorrect}
                  onChange={(e) => setActivityFeedbackCorrect(e.target.value)}
                  placeholder="Mensaje cuando la respuesta es correcta..."
                />
                <Input
                  label="Feedback Incorrecto"
                  value={activityFeedbackIncorrect}
                  onChange={(e) => setActivityFeedbackIncorrect(e.target.value)}
                  placeholder="Mensaje cuando la respuesta es incorrecta..."
                />
              </div>
            ) : null}

            {/* Question Fields */}
            {stepType === 'question' ? (
              <div className="space-y-4">
                <Textarea
                  label="Pregunta *"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Escribe la pregunta..."
                  className="min-h-[80px]"
                  error={errors.questionText}
                />
                <Input
                  label="Respuesta Esperada *"
                  value={questionExpectedAnswer}
                  onChange={(e) => setQuestionExpectedAnswer(e.target.value)}
                  placeholder="La respuesta correcta..."
                  error={errors.questionExpectedAnswer}
                />
                <Input
                  label="Feedback Correcto"
                  value={questionFeedbackCorrect}
                  onChange={(e) => setQuestionFeedbackCorrect(e.target.value)}
                  placeholder="Mensaje cuando la respuesta es correcta..."
                />
                <Input
                  label="Feedback Incorrecto"
                  value={questionFeedbackIncorrect}
                  onChange={(e) => setQuestionFeedbackIncorrect(e.target.value)}
                  placeholder="Mensaje cuando la respuesta es incorrecta..."
                />
                <Input
                  label="Pista"
                  value={questionHint}
                  onChange={(e) => setQuestionHint(e.target.value)}
                  placeholder="Pista para el estudiante..."
                />
              </div>
            ) : null}

            {/* Intro/Closure - simple content */}
            {stepType === 'intro' || stepType === 'closure' ? (
              <Textarea
                label="Contenido"
                value={scriptContent}
                onChange={(e) => setScriptContent(e.target.value)}
                placeholder={
                  stepType === 'intro' ? 'Texto de introducción...' : 'Texto de cierre...'
                }
                className="min-h-[120px]"
              />
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t-4 border-sky-200 flex gap-3">
          <Button onClick={onClose} variant="secondary" className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSave} variant="primary" className="flex-1">
            {step ? 'Guardar Cambios' : 'Crear Paso'}
          </Button>
        </div>
      </div>
    </div>
  );
}
