import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useSession, isStudentEmail } from '../../lib/useSession';

interface ClassRow { id: string; name: string; join_code: string; timezone: string }

export default function TeacherHome() {
  const session = useSession();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const { data } = await supabase.from('classes').select('id,name,join_code,timezone').order('created_at');
    setClasses(data ?? []);
  }

  useEffect(() => {
    if (!session) return;
    supabase.rpc('ensure_teacher').then(({ error }) => (error ? setError(error.message) : load()));
  }, [session]);

  if (session === undefined) return null;
  if (!session || isStudentEmail(session.user.email)) return <Navigate to="/teacher/login" replace />;

  async function create(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc('create_class', { p_name: name });
    if (error) return setError(error.message);
    setName(''); load();
  }

  return (
    <main>
      <h1>Your classes</h1>
      {classes.map((c) => (
        <div className="card" key={c.id}>
          <h2>{c.name}</h2>
          <p>Join code: <b style={{ fontSize: '1.5rem', letterSpacing: 2 }}>{c.join_code}</b></p>
        </div>
      ))}
      <form onSubmit={create} className="card">
        <label>New class name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
        <button>Create class</button>
      </form>
      {error && <p className="error">{error}</p>}
      <button className="secondary" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </main>
  );
}
