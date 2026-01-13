import { useAuth } from "../context/AuthContext";

export function useAuthUser() {
  const { user } = useAuth();
  return user;
}
