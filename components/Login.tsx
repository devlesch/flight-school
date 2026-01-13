
import React, { useState } from 'react';
import { Loader2, ArrowRight, AlertCircle, Lock, ShieldCheck } from 'lucide-react';

// Consistent SVG logo for Login screen
const INDUSTRIOUS_LOGO_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 60'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='serif' font-weight='bold' font-size='32' fill='%23FDD344' letter-spacing='4'%3EINDUSTRIOUS%3C/text%3E%3C/svg%3E";

interface LoginProps {
  onLogin: (email: string) => void;
  error?: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, error }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate network delay for effect
    setTimeout(() => {
        onLogin(email);
        setIsLoading(false);
    }, 800);
  };

  // Helper to fill demo credentials for easier testing
  const fillDemo = (roleKeyword: string) => {
    setEmail(roleKeyword);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative bg-[#013E3F] overflow-hidden">
      
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
        {/* Placeholder for the user's specific collage image. Using a high-quality office image as fallback. */}
        <img 
          src="https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2301&auto=format&fit=crop" 
          alt="Industrious Office" 
          className="w-full h-full object-cover"
        />
        {/* Dark overlay to ensure text contrast */}
        <div className="absolute inset-0 bg-[#013E3F]/80 backdrop-blur-[2px]"></div>
      </div>

      {/* Top Header Section */}
      <div className="relative z-10 w-full flex flex-col items-center pt-12 pb-8 px-6 text-center animate-in slide-in-from-top-4 duration-700">
         <div className="mb-6">
             <img 
               src={INDUSTRIOUS_LOGO_SVG} 
               alt="Industrious Logo" 
               className="h-16 w-auto object-contain" 
             />
         </div>
         
         <h1 className="text-5xl md:text-7xl font-serif font-medium leading-tight text-[#FDD344] mb-4 drop-shadow-md">
           Great days start here.
         </h1>
         <p className="text-xl text-[#F3EEE7]/90 font-light tracking-wide">
           Unit Operations Flight School
         </p>
      </div>

      {/* Login Form Card */}
      <div className="relative z-10 w-full max-w-md px-6 animate-in fade-in zoom-in-95 duration-500 delay-150">
        <div className="bg-white p-10 rounded-2xl shadow-2xl border border-[#F3EEE7]/10">
           <div className="mb-8 text-center">
             <h2 className="text-2xl font-serif text-[#013E3F] font-medium mb-2">Welcome Back</h2>
             <p className="text-[#013E3F]/60 text-sm">Please sign in to access your dashboard.</p>
           </div>

           <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#013E3F]/50 mb-2">Email or Username</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@industriousoffice.com"
                    className="w-full p-4 pl-12 bg-[#F3EEE7]/30 border border-[#013E3F]/10 rounded-lg text-[#013E3F] focus:outline-none focus:ring-2 focus:ring-[#013E3F]/20 focus:border-[#013E3F]/30 transition-all font-medium placeholder-[#013E3F]/30"
                    required
                  />
                  <Lock className="w-5 h-5 text-[#013E3F]/30 absolute left-4 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 text-red-700 text-sm bg-red-50 p-4 rounded-lg animate-in slide-in-from-top-2 border border-red-100">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="font-bold">Access Denied</p>
                    <p className="opacity-80">{error}</p>
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-[#013E3F] text-[#F3EEE7] py-4 rounded-lg font-bold uppercase tracking-widest text-xs hover:bg-[#013E3F]/90 transition-all shadow-lg shadow-[#013E3F]/20 flex items-center justify-center gap-2 group disabled:opacity-70"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
              </button>
           </form>

           {/* Security Footer */}
           <div className="mt-8 pt-6 border-t border-[#F3EEE7] flex items-center justify-center gap-2 text-[#013E3F]/40 text-xs">
              <ShieldCheck className="w-3 h-3" />
              <span>Secure Employee Portal &bull; SSL Encrypted</span>
           </div>

           {/* Demo Links */}
           <div className="mt-6 text-center">
              <p className="text-[10px] uppercase font-bold text-[#013E3F]/20 mb-2">Test Login (Click to fill)</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button onClick={() => fillDemo('admin')} className="text-xs px-2 py-1 bg-[#F3EEE7] text-[#013E3F]/60 rounded hover:bg-[#FDD344] hover:text-[#013E3F] transition-colors font-medium">admin</button>
                <button onClick={() => fillDemo('manager')} className="text-xs px-2 py-1 bg-[#F3EEE7] text-[#013E3F]/60 rounded hover:bg-[#FDD344] hover:text-[#013E3F] transition-colors font-medium">manager</button>
                <button onClick={() => fillDemo('new')} className="text-xs px-2 py-1 bg-[#F3EEE7] text-[#013E3F]/60 rounded hover:bg-[#FDD344] hover:text-[#013E3F] transition-colors font-medium">new</button>
              </div>
           </div>
        </div>
      </div>

      <div className="absolute bottom-6 text-xs text-[#F3EEE7]/30 font-bold uppercase tracking-widest z-10">
        Internal System &copy; 2024 Industrious
      </div>
    </div>
  );
};

export default Login;