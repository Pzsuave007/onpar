import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Flag } from 'lucide-react';

export default function LoginPage() {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [regForm, setRegForm] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  if (user) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (regForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await register(regForm.email, regForm.password, regForm.name);
      toast.success('Account created!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12" data-testid="login-page">
      <Card className="w-full max-w-md border-[#E2E3DD] shadow-none">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-xl bg-[#1B3C35] flex items-center justify-center">
              <Flag className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
            Welcome to OnPar Live
          </CardTitle>
          <CardDescription className="text-[#6B6E66]">
            Sign in to manage your golf tournaments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full mb-6 h-11 border-[#E2E3DD] hover:bg-[#E8E9E3] font-medium"
            onClick={handleGoogleLogin} data-testid="google-login-btn">
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E2E3DD]" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-[#6B6E66] tracking-wider">or</span>
            </div>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-[#E8E9E3]">
              <TabsTrigger value="login" data-testid="login-tab">Sign In</TabsTrigger>
              <TabsTrigger value="register" data-testid="register-tab">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email" className="text-[#1B3C35]">Email</Label>
                  <Input id="login-email" type="email" required value={loginForm.email}
                    onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                    className="mt-1 border-[#E2E3DD] bg-white" placeholder="you@example.com"
                    data-testid="login-email-input" />
                </div>
                <div>
                  <Label htmlFor="login-password" className="text-[#1B3C35]">Password</Label>
                  <Input id="login-password" type="password" required value={loginForm.password}
                    onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="mt-1 border-[#E2E3DD] bg-white" placeholder="Your password"
                    data-testid="login-password-input" />
                </div>
                <Button type="submit" className="w-full bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-11" disabled={loading}
                  data-testid="login-submit-btn">
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="reg-name" className="text-[#1B3C35]">Full Name</Label>
                  <Input id="reg-name" required value={regForm.name}
                    onChange={e => setRegForm({ ...regForm, name: e.target.value })}
                    className="mt-1 border-[#E2E3DD] bg-white" placeholder="John Doe"
                    data-testid="register-name-input" />
                </div>
                <div>
                  <Label htmlFor="reg-email" className="text-[#1B3C35]">Email</Label>
                  <Input id="reg-email" type="email" required value={regForm.email}
                    onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                    className="mt-1 border-[#E2E3DD] bg-white" placeholder="you@example.com"
                    data-testid="register-email-input" />
                </div>
                <div>
                  <Label htmlFor="reg-password" className="text-[#1B3C35]">Password</Label>
                  <Input id="reg-password" type="password" required value={regForm.password}
                    onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                    className="mt-1 border-[#E2E3DD] bg-white" placeholder="Min 6 characters"
                    data-testid="register-password-input" />
                </div>
                <Button type="submit" className="w-full bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-11" disabled={loading}
                  data-testid="register-submit-btn">
                  {loading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
