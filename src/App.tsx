import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import Welcome from './screens/Welcome';
import Join from './screens/Join';
import Login from './screens/Login';
import Adopt from './screens/Adopt';
import Home from './screens/Home';
import TeacherLogin from './screens/teacher/TeacherLogin';
import TeacherHome from './screens/teacher/TeacherHome';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/join" element={<Join />} />
        <Route path="/login" element={<Login />} />
        <Route path="/adopt" element={<Adopt />} />
        <Route path="/home" element={<Home />} />
        <Route path="/teacher/login" element={<TeacherLogin />} />
        <Route path="/teacher" element={<TeacherHome />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
