import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";
import { api } from "./api";
import type { User } from "./types";
interface State {
  user: User | null;
  loading: boolean;
  error: string;
}
type Action =
  { type: "USER"; user: User | null } | { type: "ERROR"; message: string };
const Context = createContext<{
  state: State;
  login: (token: string, user: User) => void;
  logout: () => void;
  refresh: () => Promise<void>;
} | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    (s: State, a: Action): State =>
      a.type === "USER"
        ? { user: a.user, loading: false, error: "" }
        : { ...s, loading: false, error: a.message },
    { user: null, loading: true, error: "" },
  );
  const logout = () => {
    sessionStorage.removeItem("token");
    dispatch({ type: "USER", user: null });
  };
  const refresh = async () => {
    if (!sessionStorage.getItem("token")) {
      logout();
      return;
    }
    try {
      dispatch({ type: "USER", user: await api<User>("/auth/me") });
    } catch (e) {
      dispatch({ type: "ERROR", message: (e as Error).message });
    }
  };
  useEffect(() => {
    void refresh();
    const r = () => {
      void refresh();
    };
    window.addEventListener("logout", logout);
    window.addEventListener("refresh-user", r);
    const timer = setInterval(r, 30000);
    return () => {
      window.removeEventListener("logout", logout);
      window.removeEventListener("refresh-user", r);
      clearInterval(timer);
    };
  }, []);
  return (
    <Context.Provider
      value={{
        state,
        logout,
        refresh,
        login: (token, user) => {
          sessionStorage.setItem("token", token);
          dispatch({ type: "USER", user });
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw Error("Falta AuthProvider");
  return value;
}
