import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth, API, formatApiErrorDetail } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AdminLogin = () => {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/admin/dashboard');
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setSubmitting(true);
    
    try {
      const response = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      if (response.ok) {
        const userData = await response.json();
        login(userData);
        navigate('/admin/dashboard');
      } else {
        const data = await response.json();
        setError(formatApiErrorDetail(data.detail));
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Failed to connect to server. Please try again.");
    } finally {
      setSubmitting(false);
    }
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

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-900/20 border border-red-900 text-red-300 px-4 py-3 text-sm" data-testid="login-error">
                {error}
              </div>
            )}

            <div>
              <Label className="text-[#A3A3A3] text-sm mb-2 block">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A3A3A3]" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@luxstudio.com"
                  className="lux-input pl-10"
                  data-testid="email-input"
                />
              </div>
            </div>

            <div>
              <Label className="text-[#A3A3A3] text-sm mb-2 block">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A3A3A3]" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="lux-input pl-10 pr-10"
                  data-testid="password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full lux-btn h-12"
              disabled={submitting}
              data-testid="login-submit-btn"
            >
              {submitting ? <div className="spinner" /> : "Sign In"}
            </Button>
          </form>

          <p className="text-[#A3A3A3] text-xs text-center mt-6">
            Default: admin@luxstudio.com / Admin123!
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
