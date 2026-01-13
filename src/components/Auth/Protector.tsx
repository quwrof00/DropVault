import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthUser } from "../../hooks/useAuthUser";

interface ProtectorProps {
  children: React.ReactNode;
}

export function Protector({ children }: ProtectorProps) {
  const user = useAuthUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user === null) {
      navigate("/login");
    }
  }, [user, navigate]);

  if (user === undefined) {
    return (
       <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-400 border-r-transparent"></div>
          <p className="mt-4 text-gray-300">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
