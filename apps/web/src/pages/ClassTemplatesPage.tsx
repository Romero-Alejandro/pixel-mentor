import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { IconPlus, IconTemplate, IconBook, IconArrowRight } from '@tabler/icons-react';

import { useClassStore } from '@/features/class-management/stores/class.store';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useAudio } from '@/contexts/AudioContext';
import { usePrompt } from '@/hooks/useConfirmationDialogs';
import { Button, Card, Spinner, Input } from '@/components/ui';

export function ClassTemplatesPage() {
  const navigate = useNavigate();
  const { playClick, playSelect } = useAudio();
  const prompt = usePrompt();
  const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));

  const { templates, isLoading, error, fetchTemplates, createTemplate, createClassFromTemplate } =
    useClassStore(
      useShallow((state) => ({
        templates: state.templates,
        isLoading: state.isLoading,
        error: state.error,
        fetchTemplates: state.fetchTemplates,
        createTemplate: state.createTemplate,
        createClassFromTemplate: state.createClassFromTemplate,
      })),
    );

  const [isCreating, setIsCreating] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');

  useEffect(() => {
    if (user?.role === 'TEACHER') {
      fetchTemplates();
    }
  }, [user, fetchTemplates]);

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) return;
    playClick();
    try {
      await createTemplate({
        name: newTemplateName.trim(),
        description: newTemplateDescription.trim() || undefined,
      });
      setNewTemplateName('');
      setNewTemplateDescription('');
      setIsCreating(false);
    } catch {
      // Error handled in store
    }
  };

  const handleCreateClassFromTemplate = async (templateId: string) => {
    playSelect();
    const title = await prompt({
      title: 'Nueva clase',
      message: '¿Qué título quieres para esta clase?',
      defaultValue: '',
    });
    if (!title?.trim()) return;
    try {
      const newClass = await createClassFromTemplate(templateId, title.trim());
      navigate(`/classes/${newClass.id}/edit`);
    } catch {
      // Error handled in store
    }
  };

  if (user?.role !== 'TEACHER') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Card variant="mission" className="max-w-md text-center p-8">
          <IconTemplate className="w-16 h-16 text-sky-400 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">Acceso restringido</h2>
          <p className="text-slate-500 font-medium">
            Solo los tutores pueden acceder a la gestión de plantillas.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b-4 border-sky-200 shadow-gummy shadow-sky-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconTemplate className="w-8 h-8 text-sky-500" stroke={2.5} />
            <h1 className="text-2xl font-black text-sky-700 tracking-tight">Plantillas</h1>
          </div>
          <Button onClick={() => setIsCreating(true)} variant="primary">
            <IconPlus className="w-5 h-5 mr-2" />
            Nueva Plantilla
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Create template form */}
        {isCreating ? (
          <Card variant="mission" className="p-6 mb-8">
            <h2 className="text-xl font-black text-slate-800 mb-4">Crear nueva plantilla</h2>
            <div className="space-y-4 max-w-lg">
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Nombre de la plantilla"
                className="w-full"
              />
              <Input
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="Descripción (opcional)"
                className="w-full"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleCreateTemplate}
                  variant="primary"
                  disabled={!newTemplateName.trim()}
                >
                  <IconPlus className="w-5 h-5 mr-2" />
                  Crear
                </Button>
                <Button onClick={() => setIsCreating(false)} variant="secondary">
                  Cancelar
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {/* Error display */}
        {error ? (
          <div className="bg-rose-100 border-4 border-rose-200 rounded-2xl p-4 mb-6">
            <p className="text-rose-700 font-bold">{error}</p>
          </div>
        ) : null}

        {/* Loading state */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Spinner size="lg" className="text-sky-500" />
            <p className="text-lg font-black text-sky-600 animate-pulse">Cargando plantillas...</p>
          </div>
        ) : templates.length === 0 ? (
          <Card variant="mission" className="text-center p-12">
            <IconTemplate className="w-16 h-16 text-sky-300 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-slate-700 mb-2">No tienes plantillas aún</h2>
            <p className="text-slate-500 font-medium mb-6">
              Crea una plantilla para reutilizar estructuras de clases
            </p>
            <Button onClick={() => setIsCreating(true)} variant="primary">
              <IconPlus className="w-5 h-5 mr-2" />
              Crear mi primera plantilla
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} variant="mission" className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
                    <IconTemplate className="w-6 h-6 text-violet-500" />
                  </div>
                  <span className="text-xs text-slate-400">
                    {template.createdAt
                      ? new Date(template.createdAt).toLocaleDateString('es-ES')
                      : 'Sin fecha'}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-800 mb-2">{template.name}</h3>
                {template.description ? (
                  <p className="text-slate-500 font-medium text-sm mb-4 line-clamp-2">
                    {template.description}
                  </p>
                ) : null}
                <Button
                  onClick={() => handleCreateClassFromTemplate(template.id)}
                  variant="secondary"
                  className="w-full"
                >
                  <IconBook className="w-5 h-5 mr-2" />
                  Crear clase
                  <IconArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
