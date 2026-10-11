import { Link, Navigate } from 'react-router';
import { useSession, isStudentEmail } from '../lib/useSession';

export default function Welcome() {
  const session = useSession();
  if (session === undefined) return null;
  if (session) return <Navigate to={isStudentEmail(session.user.email) ? '/home' : '/teacher'} replace />;
  return (
    <main>
      <h1>Tend 🌱</h1>
      <p>Adopt a pet. Keep it happy with a tiny spark from this week's Come Follow Me.</p>
      <Link to="/join"><button>Join my class</button></Link>
      <Link to="/login"><button className="secondary">I already have a pet</button></Link>
      <p style={{ marginTop: 32, textAlign: 'center' }}><Link to="/teacher/login">I'm a teacher</Link></p>
    </main>
  );
}
