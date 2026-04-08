import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Camera } from "lucide-react";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";

const AdminLogin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-6" data-testid="admin-login-page">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Camera className="w-10 h-10 text-[#C8A97E]" />
            <span className="font-serif text-3xl tracking-tight text-white">Lux Studio</span>
          </div>
          <p className="lux-overline">Admin Portal</p>
        </div>

        {/* Login Card */}
        <div className="lux-card animate-slide-up" data-testid="login-card">
          <h1 className="font-serif text-2xl text-white text-center mb-2">Welcome Back</h1>
          <p className="text-[#A3A3A3] text-center mb-8">Sign in to manage your photo events</p>

          <Button
            onClick={handleGoogleLogin}
            className="w-full bg-white text-black hover:bg-gray-200 h-12 text-base"
            data-testid="google-login-btn"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>

          <p className="text-[#A3A3A3] text-xs text-center mt-6">
            Only authorized administrators can access this portal
          </p>
        </div>

        {/* Back Link */}
        <div className="text-center mt-8 animate-slide-up stagger-1">
          <a 
            href="/" 
            className="text-[#A3A3A3] hover:text-white transition-colors text-sm"
            data-testid="back-to-gallery"
          >
            ← Back to Gallery
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
