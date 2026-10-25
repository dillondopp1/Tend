import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import Welcome from './screens/Welcome';
import Join from './screens/Join';
import Login from './screens/Login';
import Adopt from './screens/Adopt';
import Home from './screens/Home';
import Spark from './screens/Spark';
import WeekList from './screens/WeekList';
import Play from './screens/Play';
import GameScreen from './screens/GameScreen';
import TeacherLogin from './screens/teacher/TeacherLogin';
import TeacherHome from './screens/teacher/TeacherHome';
import GameShowHost from './screens/gameshow/Host';
import GameShowPhone from './screens/gameshow/Phone';
import GameShowRemote from './screens/gameshow/Remote';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/join" element={<Join />} />
        <Route path="/login" element={<Login />} />
        <Route path="/adopt" element={<Adopt />} />
        <Route path="/home" element={<Home />} />
        <Route path="/spark/:date" element={<Spark />} />
        <Route path="/week" element={<WeekList />} />
        <Route path="/play" element={<Play />} />
        <Route path="/play/:game" element={<GameScreen />} />
        <Route path="/teacher/login" element={<TeacherLogin />} />
        <Route path="/teacher" element={<TeacherHome />} />
        <Route path="/teacher/gameshow" element={<GameShowHost />} />
        <Route path="/teacher/remote" element={<GameShowRemote />} />
        <Route path="/gameshow" element={<GameShowPhone />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
