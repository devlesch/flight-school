import React from 'react';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

// Consistent SVG logo for Login screen
const INDUSTRIOUS_LOGO_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 60'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='serif' font-weight='bold' font-size='32' fill='%23FDD344' letter-spacing='4'%3EINDUSTRIOUS%3C/text%3E%3C/svg%3E";

// Google logo SVG
const GoogleLogo = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

interface LoginProps {
  onLogin: () => void;
  loading?: boolean;
  error?: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, loading = false, error }) => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative bg-[#013E3F] overflow-hidden">

      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
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

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md px-6 animate-in fade-in zoom-in-95 duration-500 delay-150">
        <div className="bg-white p-10 rounded-2xl shadow-2xl border border-[#F3EEE7]/10">
           <div className="mb-8 text-center">
             <h2 className="text-2xl font-serif text-[#013E3F] font-medium mb-2">Welcome</h2>
             <p className="text-[#013E3F]/60 text-sm">Sign in with your Google account to continue.</p>
           </div>

           {error && (
             <div className="flex items-start gap-3 text-red-700 text-sm bg-red-50 p-4 rounded-lg animate-in slide-in-from-top-2 border border-red-100 mb-6">
               <AlertCircle className="w-5 h-5 flex-shrink-0" />
               <div>
                 <p className="font-bold">Sign In Failed</p>
                 <p className="opacity-80">{error}</p>
               </div>
             </div>
           )}

           <button
             onClick={onLogin}
             disabled={loading}
             className="w-full bg-white border-2 border-[#013E3F]/20 text-[#013E3F] py-4 px-6 rounded-lg font-medium hover:bg-[#F3EEE7] hover:border-[#013E3F]/30 transition-all shadow-sm flex items-center justify-center gap-3 group disabled:opacity-70 disabled:cursor-not-allowed"
           >
             {loading ? (
               <Loader2 className="w-5 h-5 animate-spin" />
             ) : (
               <>
                 <GoogleLogo />
                 <span>Sign in with Google</span>
               </>
             )}
           </button>

           {/* Security Footer */}
           <div className="mt-8 pt-6 border-t border-[#F3EEE7] flex items-center justify-center gap-2 text-[#013E3F]/40 text-xs">
              <ShieldCheck className="w-3 h-3" />
              <span>Secure Employee Portal &bull; SSL Encrypted</span>
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
