import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import {
  IconArrowLeft,
  IconSend,
  IconCheck,
  IconBook,
  IconPlayerPlay,
  IconPlus,
  IconEye,
  IconUsers,
  IconAlertCircle,
} from '@tabler/icons-react';
import type { ClassStatus } from '@pixel-mentor/shared';

import { useClassStore } from '@/features/class-management/stores/class.store';
import { api } from '@/services/api';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useAudio } from '@/contexts/AudioContext';
import { useAlert, useConfirm } from '@/hooks/use-confirmation-dialogs';
import { ClassLessonList } from '@/features/class-management/components/ClassLessonList';
import { Button, Card, Spinner, Input, Textarea, Modal } from '@/components/ui';

const STATUS_LABELS: Record<ClassStatus, string> = {
  DRAFT: 'Borrador',
  UNDER_REVIEW: 'En revisión',
  PUBLISHED: 'Publicada',
  ARCHIVED: 'Archivada',
};

const STATUS_COLORS: Record<ClassStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700 border-amber-300',
  PUBLISHED: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  ARCHIVED: 'bg-rose-100 text-rose-700 border-rose-300',
};

export function ClassEditorPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { playClick, playSelect, playToastSuccess } = useAudio();
  const alert = useAlert();
  const confirm = useConfirm();
  const { user } = useAuth();

  const {
    currentClass,
    isLoading,
    error,
    fetchClass,
    updateClass,
    publishClass,
    unpublishClass,
    addLesson,
    removeLesson,
    reorderLessons,
    updateLesson,
  } = useClassStore(
    useShallow((state) => ({
      currentClass: state.currentClass,
      isLoading: state.isLoading,
      error: state.error,
      fetchClass: state.fetchClass,
      updateClass: state.updateClass,
      publishClass: state.publishClass,
      unpublishClass: state.unpublishClass,
      addLesson: state.addLesson,
      removeLesson: state.removeLesson,
      reorderLessons: state.reorderLessons,
      updateLesson: state.updateLesson,
    })),
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetAgeMin, setTargetAgeMin] = useState<number | ''>('');
  const [targetAgeMax, setTargetAgeMax] = useState<number | ''>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewVoiceText, setPreviewVoiceText] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);

  // Serialized snapshot of the last persisted values; the autosave effect
  // compares against it so it never saves on mount and never saves the
  // same values twice.
  const savedSnapshotRef = useRef('');

  // If navigating to /classes/new, redirect to list (creation happens there)
  useEffect(() => {
    if (classId === 'new') {
      navigate('/classes', { replace: true });
    }
  }, [classId, navigate]);

  useEffect(() => {
    if (classId && classId !== 'new' && user) {
      fetchClass(classId);
    }
  }, [classId, user, fetchClass]);

  useEffect(() => {
    if (currentClass) {
      setTitle(currentClass.title);
      setDescription(currentClass.description ?? '');
      setTargetAgeMin(currentClass.targetAgeMin ?? '');
      setTargetAgeMax(currentClass.targetAgeMax ?? '');
      savedSnapshotRef.current = JSON.stringify([
        currentClass.title,
        currentClass.description ?? '',
        currentClass.targetAgeMin ?? '',
        currentClass.targetAgeMax ?? '',
      ]);
    }
  }, [currentClass]);

  const isDraft = currentClass?.status === 'DRAFT';

  // Debounced autosave: persists title/description/ages ~1s after the last
  // keystroke. Only for DRAFT classes (the API rejects edits otherwise) and
  // only when the values actually differ from the last saved snapshot.
  useEffect(() => {
    if (!currentClass || !classId || !isDraft) return;
    if (!isEditing) return;
    if (typeof title !== 'string' || !title.trim()) return; // never autosave an empty title

    const snapshot = JSON.stringify([title, description, targetAgeMin, targetAgeMax]);
    if (snapshot === savedSnapshotRef.current) return;

    const timer = setTimeout(() => {
      void updateClass(classId, {
        title: title.trim(),
        description,
        targetAgeMin: targetAgeMin === '' ? null : targetAgeMin,
        targetAgeMax: targetAgeMax === '' ? null : targetAgeMax,
      })
        .then(() => {
          savedSnapshotRef.current = snapshot;
          setIsEditing(false);
          return undefined;
        })
        .catch(() => {
          // Error surfaced by store state; keep isEditing so the user can retry manually.
        });
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    title,
    description,
    targetAgeMin,
    targetAgeMax,
    isEditing,
    isDraft,
    currentClass,
    classId,
    updateClass,
  ]);

  // Warn before losing unsaved changes on tab close / hard navigation.
  useEffect(() => {
    if (!isEditing) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditing]);

  const handleSave = async () => {
    if (!currentClass || !classId) return;
    setIsSaving(true);
    try {
      await updateClass(classId, {
        title,
        description,
        targetAgeMin: targetAgeMin === '' ? null : targetAgeMin,
        targetAgeMax: targetAgeMax === '' ? null : targetAgeMax,
      });
      savedSnapshotRef.current = JSON.stringify([title, description, targetAgeMin, targetAgeMax]);
      setIsEditing(false);
      playToastSuccess();
    } catch {
      // Error handled in store
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = async () => {
    if (isEditing) {
      const leave = await confirm({
        title: 'Cambios sin guardar',
        message: 'Hay cambios que aún se están guardando. ¿Seguro que quieres salir?',
        variant: 'warning',
      });
      if (!leave) return;
    }
    navigate('/classes');
  };

  const handlePreview = async () => {
    if (!currentClass || !classId) return;
    playClick();
    setIsPreviewing(true);
    try {
      const preview = await api.previewClass(classId);
      setPreviewVoiceText(preview.voiceText || 'La clase no tiene contenido de voz todavía.');
      setPreviewTitle(preview.title);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'No se pudo generar la vista previa';
      await alert({ title: 'Vista previa', message, variant: 'warning' });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handlePublish = async () => {
    if (!currentClass || !classId) return;
    playClick();
    if (currentClass.status !== 'DRAFT') {
      await alert({
        title: 'No se puede publicar',
        message: 'Solo se pueden publicar clases en estado Borrador',
        variant: 'warning',
      });
      return;
    }
    if (!currentClass.lessons || currentClass.lessons.length < 1) {
      await alert({
        title: 'No se puede publicar',
        message: 'La clase debe tener al menos una lección para poder publicarse',
        variant: 'warning',
      });
      return;
    }
    if (targetAgeMin === '' || targetAgeMax === '') {
      await alert({
        title: 'Falta el rango de edad',
        message:
          'Indica para qué edades está pensada la clase (3 a 18 años). Ayuda a adaptar el contenido a los niños.',
        variant: 'warning',
      });
      return;
    }
    try {
      await publishClass(classId, {
        targetAgeMin,
        targetAgeMax,
      });
      playToastSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al publicar la clase';
      await alert({ title: 'Error', message, variant: 'error' });
    }
  };

  const handleUnpublish = async () => {
    if (!currentClass || !classId) return;
    playClick();
    if (currentClass.status === 'DRAFT') {
      await alert({
        title: 'No se puede despublicar',
        message: 'La clase ya está en estado Borrador',
        variant: 'warning',
      });
      return;
    }
    try {
      await unpublishClass(classId);
      playToastSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al despublicar la clase';
      await alert({ title: 'Error', message, variant: 'error' });
    }
  };

  const handleAddLesson = async (recipeId: string) => {
    if (!currentClass || !classId || !recipeId.trim()) return;
    if (currentClass.status !== 'DRAFT') {
      await alert({
        title: 'No se puede agregar',
        message:
          'Solo puedes agregar lecciones a clases en estado Borrador. Cambia el estado a Borrador primero.',
        variant: 'warning',
      });
      return;
    }
    playClick();
    const order = (currentClass.lessons?.length ?? 0) + 1;
    try {
      await addLesson(classId, { recipeId: recipeId.trim(), order });
      playToastSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al agregar la lección';
      await alert({ title: 'Error', message, variant: 'error' });
    }
  };

  const handleRemoveLesson = async (lessonId: string) => {
    if (!currentClass || !classId) return;
    if (currentClass.status !== 'DRAFT') {
      await alert({
        title: 'No se puede eliminar',
        message:
          'Solo puedes eliminar lecciones de clases en estado Borrador. Cambia el estado a Borrador primero.',
        variant: 'warning',
      });
      return;
    }
    playClick();
    try {
      await removeLesson(classId, lessonId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar la lección';
      await alert({ title: 'Error', message, variant: 'error' });
    }
  };

  const handleReorder = async (lessonIds: string[]) => {
    if (!currentClass || !classId) return;
    playSelect();
    try {
      await reorderLessons(classId, lessonIds);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al reordenar las lecciones';
      await alert({ title: 'Error', message, variant: 'error' });
    }
  };

  const handleUpdateLesson = async (lessonId: string, data: { recipeId: string }) => {
    if (!currentClass || !classId) return;
    playClick();
    try {
      await updateLesson(classId, lessonId, data);
      playToastSuccess();
    } catch {
      // Error handled in store
    }
  };

  const canPublish = currentClass?.status === 'DRAFT' && (currentClass.lessons?.length ?? 0) > 0;

  // Demo eligibility: need at least one lesson with a recipeId
  const lessonsWithRecipe = currentClass?.lessons?.filter((l) => l.recipeId).length ?? 0;
  const totalLessons = currentClass?.lessons?.length ?? 0;
  const hasDemoLesson = lessonsWithRecipe > 0;

  if (user?.role !== 'TEACHER' && user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Card variant="mission" className="max-w-md text-center p-8">
          <IconBook className="w-16 h-16 text-sky-400 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">Acceso restringido</h2>
          <p className="text-slate-500 font-medium">Solo los tutores pueden editar clases.</p>
        </Card>
      </div>
    );
  }

  if (isLoading && !currentClass) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 flex flex-col items-center justify-center gap-4">
        <Spinner size="lg" className="text-sky-500" />
        <p className="text-lg font-black text-sky-600 animate-pulse">Cargando...</p>
      </div>
    );
  }

  if (!currentClass) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Card variant="mission" className="max-w-md text-center p-8">
          <IconBook className="w-16 h-16 text-sky-400 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">Clase no encontrada</h2>
          <p className="text-slate-500 font-medium mb-6">
            La clase que buscas no existe o fue eliminada.
          </p>
          <Button onClick={() => navigate('/classes')} variant="primary">
            <IconArrowLeft className="w-5 h-5 mr-2" />
            Volver a mis clases
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b-4 border-sky-200 shadow-gummy shadow-sky-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 rounded-xl hover:bg-sky-50 transition-colors"
            >
              <IconArrowLeft className="w-6 h-6 text-sky-500" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-sky-700">Editar Clase</h1>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border-2 ${STATUS_COLORS[currentClass.status]}`}
                >
                  {STATUS_LABELS[currentClass.status]}
                </span>
              </div>
              {/* Progress indicator */}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-slate-500">
                  {currentClass.lessons?.length ?? 0} lección
                  {(currentClass.lessons?.length ?? 0) !== 1 ? 'es' : ''}
                </span>
                {hasDemoLesson ? (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    ✓ Lista para demo
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    Agrega lecciones con unidad
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentClass.status === 'DRAFT' ? (
              <Button
                onClick={handlePreview}
                variant="secondary"
                disabled={isPreviewing || !hasDemoLesson}
                title="Escucha la clase como la escucharía un niño"
              >
                <IconEye className="w-5 h-5 mr-2" />
                {isPreviewing ? 'Generando...' : 'Vista previa'}
              </Button>
            ) : null}
            {currentClass.status === 'PUBLISHED' ? (
              <Button onClick={handleUnpublish} variant="danger" disabled={isLoading}>
                <IconSend className="w-5 h-5 mr-2" />
                Despublicar
              </Button>
            ) : (
              <Button onClick={handlePublish} variant="success" disabled={!canPublish || isLoading}>
                <IconSend className="w-5 h-5 mr-2" />
                Publicar
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error display */}
        {error ? (
          <div className="bg-rose-100 border-4 border-rose-200 rounded-2xl p-4 mb-6">
            <p className="text-rose-700 font-bold">{error}</p>
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & Description */}
            <Card variant="mission" className="p-6">
              <h2 className="text-xl font-black text-slate-800 mb-4">Información de la clase</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Título</label>
                  <Input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setIsEditing(true);
                    }}
                    placeholder="Título de la clase"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Descripción</label>
                  <Textarea
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setIsEditing(true);
                    }}
                    placeholder="Descripción de la clase..."
                    className="w-full min-h-[120px]"
                  />
                </div>
                {isDraft ? (
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                      <IconUsers className="w-4 h-4" />
                      Rango de edad del público infantil
                    </label>
                    <div className="flex items-center gap-4 max-w-xs">
                      <div className="flex-1">
                        <Input
                          type="number"
                          value={targetAgeMin}
                          onChange={(e) => {
                            setTargetAgeMin(e.target.value === '' ? '' : Number(e.target.value));
                            setIsEditing(true);
                          }}
                          min={3}
                          max={18}
                        />
                        <span className="text-xs text-slate-500">Edad mínima</span>
                      </div>
                      <span className="text-slate-400 font-bold">-</span>
                      <div className="flex-1">
                        <Input
                          type="number"
                          value={targetAgeMax}
                          onChange={(e) => {
                            setTargetAgeMax(e.target.value === '' ? '' : Number(e.target.value));
                            setIsEditing(true);
                          }}
                          min={3}
                          max={18}
                        />
                        <span className="text-xs text-slate-500">Edad máxima</span>
                      </div>
                    </div>
                    {targetAgeMin !== '' && targetAgeMax !== '' && targetAgeMin > targetAgeMax ? (
                      <p className="text-xs text-rose-600 mt-2 flex items-center gap-1">
                        <IconAlertCircle className="w-3 h-3" />
                        La edad mínima no puede ser mayor a la máxima
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {isEditing ? (
                  <div className="flex justify-end items-center gap-3">
                    <span className="text-xs font-bold text-sky-500 animate-pulse">
                      Guardado automático activado
                    </span>
                    <Button onClick={handleSave} variant="primary" isLoading={isSaving}>
                      <IconCheck className="w-5 h-5 mr-2" />
                      Guardar ahora
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>

            {/* Lessons */}
            <Card variant="mission" className="p-6" id="lessons-section">
              <h2 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
                <IconBook className="w-6 h-6 text-sky-500" />
                Lecciones ({currentClass.lessons?.length ?? 0})
              </h2>

              {currentClass.status !== 'DRAFT' ? (
                <div className="mb-4 bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="text-amber-600 text-sm font-medium">
                    Esta clase está en estado{' '}
                    <span className="font-bold">{currentClass.status}</span>. Solo se pueden editar
                    clases en estado Borrador.
                  </div>
                </div>
              ) : null}

              <ClassLessonList
                lessons={currentClass.lessons ?? []}
                onAddLesson={handleAddLesson}
                onRemoveLesson={handleRemoveLesson}
                onEditLesson={handleUpdateLesson}
                onReorder={handleReorder}
              />
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Publish checklist (child-appropriateness) */}
            <Card variant="mission" className="p-6">
              <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                <IconCheck className="w-6 h-6 text-emerald-500" />
                Checklist para publicar
              </h2>
              <div className="space-y-3">
                {[
                  {
                    ok: (currentClass.lessons?.length ?? 0) >= 1,
                    label: 'Al menos una lección',
                  },
                  {
                    ok: hasDemoLesson,
                    label: 'Lecciones con unidad asignada',
                  },
                  {
                    ok: targetAgeMin !== '' && targetAgeMax !== '' && targetAgeMin <= targetAgeMax,
                    label: 'Rango de edad definido (3-18)',
                  },
                  {
                    ok: title.trim().length >= 3,
                    label: 'Título claro (mínimo 3 letras)',
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border-2 ${
                        item.ok
                          ? 'bg-emerald-100 text-emerald-600 border-emerald-200'
                          : 'bg-slate-100 text-slate-300 border-slate-200'
                      }`}
                    >
                      ✓
                    </span>
                    <span
                      className={`text-sm font-bold ${item.ok ? 'text-slate-600' : 'text-slate-400'}`}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
                {(() => {
                  const totalMinutes =
                    currentClass.lessons?.reduce(
                      (acc, l) => acc + (l.recipe?.expectedDurationMinutes ?? 0),
                      0,
                    ) ?? 0;
                  const avgAge =
                    targetAgeMin !== '' && targetAgeMax !== ''
                      ? (targetAgeMin + targetAgeMax) / 2
                      : null;
                  const cap = avgAge === null ? null : avgAge <= 7 ? 15 : avgAge <= 12 ? 25 : 45;
                  if (cap === null || totalMinutes === 0) return null;
                  return (
                    <p
                      className={`text-xs font-bold mt-2 ${
                        totalMinutes / Math.max(currentClass.lessons?.length ?? 1, 1) <= cap
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {totalMinutes / Math.max(currentClass.lessons?.length ?? 1, 1) <= cap
                        ? `✓ Duración adecuada para la edad (máx ~${cap} min por lección)`
                        : `⚠ Lecciones largas para la edad: se recomienda ~${cap} min máximo`}
                    </p>
                  );
                })()}
              </div>
            </Card>

            {/* Demo Status */}
            <Card variant="mission" className="p-6">
              <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                <IconPlayerPlay className="w-6 h-6 text-sky-500" />
                Demo Status
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Lecciones totales</span>
                  <span className="text-2xl font-black text-sky-600">{totalLessons}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Lecciones con unidad</span>
                  <span className="text-2xl font-black text-sky-600">
                    {lessonsWithRecipe}/{totalLessons}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Estado</span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border-2 ${
                      hasDemoLesson
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                        : 'bg-amber-100 text-amber-700 border-amber-300'
                    }`}
                  >
                    {hasDemoLesson ? (
                      <>
                        <IconCheck className="w-3 h-3 mr-1" />
                        Listo
                      </>
                    ) : (
                      'Necesita unidad'
                    )}
                  </span>
                </div>
                {!hasDemoLesson ? (
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 mt-4">
                    <p className="text-amber-800 text-sm font-medium">
                      Asigna una unidad a al menos una lección para habilitar la demo.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        onClick={() => {
                          document
                            .getElementById('lessons-section')
                            ?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                      >
                        Asignar unidades
                      </Button>
                      <Button
                        onClick={() => {
                          navigate('/units/new/edit');
                        }}
                        variant="primary"
                        size="sm"
                        className="flex-1"
                      >
                        <IconPlus className="w-4 h-4 mr-1" />
                        Crear unidad
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>

            {/* Class Overview */}
            <Card variant="mission" className="p-6">
              <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                <IconBook className="w-6 h-6 text-sky-500" />
                Resumen
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Estado</span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border-2 ${STATUS_COLORS[currentClass.status]}`}
                  >
                    {STATUS_LABELS[currentClass.status]}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Duración total</span>
                  <span className="text-xl font-black text-sky-600">
                    {Math.round(
                      (currentClass.lessons?.reduce(
                        (acc, l) => acc + (l.recipe?.expectedDurationMinutes ?? 0),
                        0,
                      ) ?? 0) / 60,
                    )}
                    h
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Versión</span>
                  <span className="text-xl font-black text-slate-600">v{currentClass.version}</span>
                </div>
              </div>
            </Card>

            {/* Help */}
            <Card variant="mission" className="p-6 bg-sky-50">
              <h2 className="text-lg font-black text-sky-800 mb-3">¿Necesitas ayuda?</h2>
              <p className="text-sky-600 font-medium text-sm mb-4">
                Usa el botón "Generar con IA" para crear una estructura de clase automáticamente
                basada en un tema y objetivos de aprendizaje.
              </p>
              <p className="text-sky-600 font-medium text-sm">
                Para publicar, la clase debe tener al menos una lección.
              </p>
              {!hasDemoLesson ? (
                <p className="text-amber-600 font-medium text-sm mt-4">
                  ⚠️ Para iniciar una demo, asignar una unidad a una lección.
                </p>
              ) : null}
              {hasDemoLesson ? (
                <p className="text-emerald-600 font-medium text-sm mt-4">
                  ✓ La clase está lista para demo.
                </p>
              ) : null}
            </Card>
          </div>
        </div>
      </main>

      {/* Preview modal: hear the first lesson as a child would */}
      <Modal
        isOpen={previewVoiceText !== null}
        title={`Vista previa${previewTitle ? `: ${previewTitle}` : ''}`}
        size="lg"
        onClose={() => setPreviewVoiceText(null)}
        footer={
          <Button onClick={() => setPreviewVoiceText(null)} variant="primary" className="w-full">
            Entendido
          </Button>
        }
      >
        <div className="bg-sky-50 border-4 border-white shadow-gummy rounded-[1.5rem] p-6">
          <p className="text-slate-700 font-medium whitespace-pre-wrap">{previewVoiceText}</p>
        </div>
        <p className="text-xs text-slate-400 font-bold mt-4 text-center">
          Esto es lo que escuchará un niño al iniciar la primera lección.
        </p>
      </Modal>
    </div>
  );
}
