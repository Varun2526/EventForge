import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Flame, UserPlus, Mail, Lock, User } from 'lucide-react';

const SUGGESTED_INTERESTS = ['ai', 'cloud', 'security', 'microservices', 'devops', 'web3', 'react'];

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    company: '',
    jobTitle: '',
    interests: ['ai', 'microservices'],
  });
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const handleInterestToggle = (tag) => {
    setFormData((prev) => {
      const exists = prev.interests.includes(tag);
      return {
        ...prev,
        interests: exists ? prev.interests.filter((t) => t !== tag) : [...prev.interests, tag],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register({
        ...formData,
        globalRole: 'user',
      });
      success('Account created successfully! Welcome to EventForge.');
      navigate('/events');
    } catch (err) {
      error(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md glass-card gradient-border p-8 shadow-card space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-accent p-0.5 mx-auto shadow-glow-brand">
            <div className="w-full h-full bg-surface rounded-[10px] flex items-center justify-center">
              <Flame className="w-6 h-6 text-brand-400" />
            </div>
          </div>
          <h2 className="text-2xl font-display font-bold text-white">Join EventForge</h2>
          <p className="text-xs text-slate-400">Unlock ticket reservations and AI session recommendations</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Elena Rostova"
                className="input-field pl-10 text-xs py-2.5"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="elena@example.com"
                className="input-field pl-10 text-xs py-2.5"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password *</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={8}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Minimum 8 characters"
                className="input-field pl-10 text-xs py-2.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Job Title</label>
              <input
                type="text"
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                placeholder="Software Engineer"
                className="input-field text-xs py-2.5"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Company</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Acme Inc."
                className="input-field text-xs py-2.5"
              />
            </div>
          </div>

          {/* Interests Pills (Used for Jaccard AI Recommendations) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Technical Interests</span>
              <span className="text-[10px] text-brand-400 font-normal">Powers AI recommendations</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_INTERESTS.map((tag) => {
                const isSelected = formData.interests.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleInterestToggle(tag)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all ${
                      isSelected
                        ? 'bg-brand-500 text-white shadow-glow-brand'
                        : 'bg-surface text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 font-semibold text-xs flex items-center justify-center gap-2 mt-2"
          >
            <UserPlus className="w-4 h-4" />
            {loading ? 'Creating Profile...' : 'Complete Registration'}
          </button>
        </form>

        <div className="text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-semibold">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
