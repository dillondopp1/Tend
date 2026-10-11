import { Link, Navigate } from 'react-router';
import { useSession, isStudentEmail } from '../lib/useSession';
import Pet from '../pet/Pet';

export default function Welcome() {
  const session = useSession();
  if (session === undefined) return null;
  if (session) return <Navigate to={isStudentEmail(session.user.email) ? '/home' : '/teacher'} replace />;
  return (
    <main className="hero">
      <div className="pets">
        <Pet species="bunny" size={120} mood="thriving" />
        <Pet species="fox" size={150} mood="thriving" />
        <Pet species="axolotl" size={120} mood="thriving" />
      </div>
      <h1 className="logo">Tend</h1>
      <p className="sub">Adopt a pet. Keep it happy with a one-minute spark from this week's Come Follow Me.</p>
      <Link to="/join"><button>Join my class</button></Link>
      <Link to="/login"><button className="secondary">I already have a pet</button></Link>
      <p style={{ marginTop: 32 }}><Link to="/teacher/login">I'm a teacher</Link></p>
    </main>
  );
}
