'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Shield,
  Lock,
  Globe,
  Settings,
  Database,
  CheckCircle2,
  ArrowRight,
  Code,
  GitBranch,
  Terminal,
  Zap,
  Server,
  Cpu,
  GitPullRequest
} from 'lucide-react';
import { staggerContainer, staggerItem, fadeIn } from '@/lib/motion';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-brand-dark relative overflow-hidden">
      {/* Font Import for Syne */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap');
        .font-syne { font-family: 'Syne', sans-serif; }
        .bg-grid-pattern {
          background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 60px 60px;
        }
      `}</style>

      {/* Background Atmosphere */}
      <div className="absolute inset-0 bg-grid-pattern z-0 pointer-events-none"></div>
      <div className="animate-drift absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(123,92,228,0.12)_0%,transparent_60%)] z-0 pointer-events-none"></div>

      {/* Navigation Bar Placeholder */}
      <nav className="absolute top-0 w-full px-8 py-6 flex justify-between items-center z-50">
        <div className="text-xl font-bold tracking-wider text-white flex items-center">
          <Shield className="mr-2 h-6 w-6 text-brand-secondary" />
          DEVSENTINEL
        </div>
        <div className="hidden md:flex space-x-8 text-sm font-medium text-gray-300">
          <a href="#features" className="hover:text-brand-secondary transition-colors">FEATURES</a>
          <a href="#how-it-works" className="hover:text-brand-secondary transition-colors">HOW IT WORKS</a>
          <a href="#pricing" className="hover:text-brand-secondary transition-colors">PRICING</a>
          <a href="#docs" className="hover:text-brand-secondary transition-colors">DOCS</a>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/login">
            <button className="text-sm font-medium text-white hover:text-brand-secondary">LOG IN</button>
          </Link>
          <Link href="/upload">
            <button className="bg-white text-black px-5 py-2 rounded-full text-sm font-bold hover:bg-gray-200 transition-colors border border-transparent hover:border-brand-secondary/50">
              SIGN UP FREE
            </button>
          </Link>
        </div>
      </nav>

      <motion.main
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="pt-32 pb-16 px-6 max-w-7xl mx-auto"
      >
        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-32">
          {/* Left Column: Text */}
          <motion.div variants={staggerItem} className="text-left z-10">
            <div className="flex items-center space-x-2 mb-6">
              <div className="h-0.5 w-8 bg-brand-secondary"></div>
              <span className="text-brand-secondary text-sm font-bold tracking-widest uppercase">Autonomous Developer Security</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6 text-white font-syne">
              SECURE EVERY LINE.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00C9C8] to-[#7B5CE4]">AUTOMATICALLY.</span>
            </h1>

            <p className="text-gray-400 text-lg mb-10 max-w-[480px] leading-relaxed">
              DevSentinel AI scans your repository, detects vulnerabilities using a 5-agent LLM pipeline, and opens a patched GitHub PR — fully autonomous, zero manual review required.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/upload">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-[#7B5CE4] rounded-full text-white font-bold shadow-[0_0_24px_rgba(123,92,228,0.45)] hover:shadow-[0_0_36px_rgba(123,92,228,0.65)] hover:bg-[#8f6ef0] transition-all flex items-center justify-center gap-2"
                >
                  SCAN YOUR REPO FREE
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
              </Link>
              <Link href="/demo">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 glass-panel rounded-full text-white font-bold border border-white/10 hover:border-[#00C9C8]/40 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                >
                  WATCH DEMO →
                </motion.button>
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-5">
              <span className="text-gray-500 text-xs flex items-center gap-1">
                <Zap className="h-3 w-3 text-[#00C9C8]" /> Powered by Azure OpenAI
              </span>
              <span className="text-gray-700 text-xs">·</span>
              <span className="text-gray-500 text-xs">500+ repos scanned</span>
              <span className="text-gray-700 text-xs">·</span>
              <span className="text-gray-500 text-xs">No setup required</span>
            </div>
          </motion.div>

          {/* Right Column: 3D/Glass Visuals */}
          <motion.div variants={fadeIn} className="relative h-[500px] w-full perspective-1000">
            <div className="absolute inset-0 bg-brand-primary/20 blur-[100px] rounded-full opacity-50"></div>

            {/* Main Floating Platform */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-1/4 left-1/4 right-0 bottom-0"
            >
              {/* Central Shield Card */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-80 glass-panel rounded-2xl flex flex-col items-center justify-center p-6 border border-[#7B5CE4]/30 z-20 shadow-[0_0_40px_rgba(123,92,228,0.15)]" style={{borderTop: '2px solid #00C9C8'}}>
                <div className="w-16 h-16 bg-gradient-to-br from-[#00C9C8] to-[#7B5CE4] rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-[#7B5CE4]/30">
                  <Shield className="text-white h-8 w-8" />
                </div>
                <div className="w-full space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Scan Results</span>
                    <span className="flex items-center gap-1 text-xs text-[#00C9C8] font-bold">
                      <span className="inline-block w-2 h-2 rounded-full bg-[#00C9C8] animate-pulse"></span>
                      LIVE
                    </span>
                  </div>
                  <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-[#00C9C8] shadow-[0_0_10px_#00C9C8]"></div>
                  </div>

                  <div className="flex justify-between items-center mt-4">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Red-Team Gate</span>
                    <span className="text-xs text-[#00C9C8] font-bold">PASSED ✓</span>
                  </div>
                  <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-[92%] bg-[#7B5CE4] shadow-[0_0_10px_#7B5CE4]"></div>
                  </div>

                  <div className="pt-4 border-t border-white/5 mt-4">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Vulnerabilities Fixed</span>
                      <span className="text-[#00C9C8] font-mono font-bold">7 / 7</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Elements around */}
              <motion.div
                animate={{ y: [0, 15, 0], x: [0, 5, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute -right-4 top-10 w-40 p-3 bg-brand-surface/80 backdrop-blur-md border border-white/10 rounded-xl flex items-center space-x-3 z-30 shadow-xl"
              >
                <div className="p-2 bg-brand-primary/20 rounded-lg">
                  <GitPullRequest className="h-4 w-4 text-brand-primary" />
                </div>
                <div className="text-xs">
                  <div className="text-white font-bold">PR #42</div>
                  <div className="text-gray-400">Merged</div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, -15, 0], x: [0, -5, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="absolute -left-12 bottom-32 w-52 p-3 bg-brand-surface/80 backdrop-blur-md border border-white/10 rounded-xl flex items-center space-x-3 z-30 shadow-xl"
              >
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Terminal className="h-4 w-4 text-green-400" />
                </div>
                <div className="text-xs">
                  <div className="text-white font-bold">Injection Blocked</div>
                  <div className="text-gray-400">Sentinel Agent</div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>

        {/* Financial Impact Section */}
        <motion.div variants={staggerItem} className="mb-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 font-syne">Developer Velocity & Security</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Ship code faster without breaking things. DevSentinel handles the security review so you can focus on building.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                title: 'Automated Patching',
                desc: 'Fix vulnerabilities instantly with AI-generated pull requests that respect your code style.',
                icon: GitBranch,
                color: 'text-brand-primary'
              },
              {
                title: 'Compliance Ready',
                desc: 'SOC2, HIPAA, and GDPR compliance checks out of the box for every commit.',
                icon: CheckCircle2,
                color: 'text-brand-secondary'
              },
              {
                title: 'Shift Left',
                desc: 'Catch security issues in the PR stage before they ever reach production or staging.',
                icon: ArrowRight,
                color: 'text-white'
              },
              {
                title: 'Zero False Positives',
                desc: 'Multi-agent critique system ensures only real risks are flagged to your team.',
                icon: Shield,
                color: 'text-green-400'
              }
            ].map((item, idx) => (
              <div key={idx} className="bg-brand-surface/50 backdrop-blur-sm p-8 rounded-2xl border border-white/5 border-t border-t-white/10 relative overflow-hidden group hover:bg-brand-surface transition-colors">
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-${item.color.replace('text-', '')} to-transparent opacity-50 group-hover:opacity-100 transition-opacity`}></div>
                <item.icon className={`h-10 w-10 ${item.color} mb-6`} />
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Trusted By Section */}
        <motion.div variants={staggerItem} className="text-center mb-32 border-y border-white/5 py-12 bg-white/0">
          <p className="text-gray-500 text-sm font-bold tracking-widest uppercase mb-8">Securing Code at Innovative Companies</p>
          <div className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="text-xl font-bold text-white flex items-center font-sans tracking-tight">GITHUB</div>
            <div className="text-xl font-bold text-white flex items-center font-sans tracking-tight">VERCEL</div>
            <div className="text-xl font-bold text-white flex items-center font-sans tracking-tight">MICROSOFT</div>
            <div className="text-xl font-bold text-white flex items-center font-sans tracking-tight">AWS</div>
            <div className="text-xl font-bold text-white flex items-center font-sans tracking-tight">OPENAI</div>
          </div>
        </motion.div>

        {/* Solutions Grid */}
        <motion.div variants={staggerItem} className="mb-20">
          <div className="mb-12">
            <div className="flex items-center space-x-2 mb-4">
              <div className="h-0.5 w-8 bg-brand-primary"></div>
              <span className="text-brand-primary text-sm font-bold tracking-widest uppercase">Core Capabilities</span>
            </div>
            <h2 className="text-4xl font-bold text-white font-syne">FULL-STACK<br />PROTECTION</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'CI/CD Integration', icon: Server, color: 'text-brand-secondary', desc: 'Seamlessly integrates with GitHub Actions and GitLab CI pipelines.' },
              { title: 'Secret Detection', icon: Lock, color: 'text-brand-primary', desc: 'Prevents API keys and tokens from leaking into source control.' },
              { title: 'Dependency Scan', icon: Database, color: 'text-brand-accent', desc: 'Identifies vulnerable npm/pip packages automatically.' },
              { title: 'Audit Logs', icon: Cpu, color: 'text-green-400', desc: 'Complete history of every scan, patch, and security decision.' },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -5 }}
                className="bg-brand-surface/40 border border-white/5 p-6 rounded-2xl group cursor-pointer hover:bg-brand-surface/60 transition-colors"
              >
                <div className={`mb-4 ${feature.color} opacity-80 group-hover:opacity-100 transition-opacity`}>
                  <feature.icon className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  {feature.desc}
                </p>
                <div className="flex items-center text-xs font-bold text-white/50 group-hover:text-white transition-colors">
                  VIEW SPECS <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.main>
    </div>
  );
}
