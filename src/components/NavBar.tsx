import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useProfile } from '../auth/useProfile';

export default function NavBar() {
  const { signOut } = useAuth();
  const { role } = useProfile();
  return (
    <>
      <nav>
        {role === 'gestor' && (
          <>
            <Link to="/gestor/ops">OP's</Link>
            <Link to="/gestor/desenhos">Desenhos</Link>
          </>
        )}
        <Link to="/operador">Operador</Link>
        <span style={{flex:1}} />
        <button onClick={signOut}>Sair</button>
      </nav>
      <div className="container">
        <Outlet />
      </div>
    </>
  );
}
