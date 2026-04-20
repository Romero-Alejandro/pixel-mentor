import { GroupList } from '@/features/group/components/GroupList';

export function GroupListPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-800">Mis Grupos</h1>
        <p className="text-slate-500 mt-2">
          Crea y gestiona grupos de estudiantes para organizar su camino de aprendizaje
        </p>
      </div>
      <GroupList />
    </div>
  );
}
