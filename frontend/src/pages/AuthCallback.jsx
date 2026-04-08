import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, API } from "@/App";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Use ref to prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      // Extract session_id from URL fragment
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.substring(1));
      const sessionId = params.get('session_id');

      if (!sessionId) {
        console.error("No session_id found");
        navigate('/admin');
        return;
      }

      try {
        // Exchange session_id for session token
        const response = await fetch(`${API}/auth/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ session_id: sessionId }),
          credentials: 'include'
        });

        if (response.ok) {
          const userData = await response.json();
          login(userData);
          
          // Clear the hash and navigate to dashboard
          window.history.replaceState(null, '', '/dashboard');
          navigate('/dashboard', { replace: true, state: { user: userData } });
        } else {
          console.error("Auth failed:", await response.text());
          navigate('/admin');
        }
      } catch (error) {
        console.error("Auth error:", error);
        navigate('/admin');
      }
    };

    processAuth();
  }, [navigate, login]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center" data-testid="auth-callback">
      <div className="spinner mb-4" />
      <p className="text-[#A3A3A3]">Signing you in...</p>
    </div>
  );
};

export default AuthCallback;
