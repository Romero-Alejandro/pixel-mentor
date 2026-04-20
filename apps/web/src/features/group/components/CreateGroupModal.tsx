import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { useGroupsStore } from '../stores/group.store';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateGroupModal({ isOpen, onClose }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { createGroup, loading, error, clearError } = useGroupsStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await createGroup({ name: name.trim(), description: description.trim() || undefined });
      setName('');
      setDescription('');
      onClose();
    } catch {
      // Error handled in store
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    clearError();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Crear Nuevo Grupo" size="sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error ? (
          <div className="p-4 bg-rose-50 border-4 border-rose-100 rounded-2xl text-rose-600 text-sm font-medium">
            {error}
          </div>
        ) : null}

        <div className="space-y-2">
          <label htmlFor="group-name" className="block text-sm font-bold text-slate-700">
            Nombre del Grupo
          </label>
          <Input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Cohorte Abril 2026"
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="group-description" className="block text-sm font-bold text-slate-700">
            Descripción (opcional)
          </label>
          <Textarea
            id="group-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe el propósito de este grupo..."
            rows={3}
            disabled={loading}
          />
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading ? 'Creando...' : 'Crear Grupo'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
