import { Link } from 'react-router-dom';

export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-primary-foreground font-bold text-xl tracking-tight">TK</span>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl shadow-xl shadow-slate-200/50 p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500 mt-2 leading-relaxed">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Taekwondo CRM · Внутренняя система управления
        </p>
      </div>
    </div>
  );
}

export const AuthLink = ({ to, children }) => (
  <Link to={to} className="font-medium text-primary hover:text-primary/80 transition-colors">
    {children}
  </Link>
);
