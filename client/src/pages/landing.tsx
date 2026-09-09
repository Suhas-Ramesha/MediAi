import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeartPulse,
  Mic,
  Image as ImageIcon,
  Shield,
  Activity,
  ArrowRight,
  CalendarCheck,
  Stethoscope,
  Sparkles,
  CheckCircle2,
  BrainCircuit,
  Fingerprint
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginForm, SignUpForm } from "@/components/AuthForms";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AuroraUI from "@/components/AuroraUI";
import { ThemeToggle } from "@/components/ThemeToggle";

const capabilities = ["Risk Prediction", "Symptom Diary", "AI Voice Analysis", "Medical Imaging", "24/7 Availability", "Encrypted Data", "Instant Triage"];

const features = [
  {
    icon: Stethoscope,
    title: "Instant Triage",
    desc: "Describe your symptoms and get structured, actionable guidance instantly without the wait.",
    color: "from-blue-500 to-indigo-500",
    align: "left",
    mockup: (
      <div className="w-full h-full flex flex-col gap-4 p-6 justify-center">
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="h-12 w-3/4 bg-white/10 dark:bg-slate-800/50 rounded-2xl border border-white/20" />
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, delay: 0.5, repeat: Infinity }} className="h-20 w-full bg-indigo-500/20 rounded-2xl border border-indigo-500/30" />
        <div className="h-12 w-1/2 bg-white/10 dark:bg-slate-800/50 rounded-2xl border border-white/20 self-end" />
      </div>
    )
  },
  {
    icon: Activity,
    title: "Risk Analysis",
    desc: "State-of-the-art machine learning models estimate your vital health metrics in real-time.",
    color: "from-cyan-500 to-emerald-500",
    align: "right",
    mockup: (
      <div className="w-full h-full flex items-end gap-2 p-6 justify-center">
        {[40, 70, 45, 90, 60, 80].map((h, i) => (
          <motion.div 
            key={i}
            initial={{ height: 0 }}
            whileInView={{ height: `${h}%` }}
            transition={{ duration: 0.8, delay: i * 0.1 }}
            className="w-1/6 bg-gradient-to-t from-emerald-500 to-cyan-400 rounded-t-lg opacity-80"
          />
        ))}
      </div>
    )
  },
  {
    icon: Mic,
    title: "Voice First",
    desc: "Feeling unwell? Just speak directly to the AI. No typing required when you need help most.",
    color: "from-fuchsia-500 to-purple-500",
    align: "left",
    mockup: (
      <div className="w-full h-full flex items-center justify-center relative">
        <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 m-auto h-32 w-32 bg-fuchsia-500/30 rounded-full blur-xl" />
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }} className="h-24 w-24 bg-gradient-to-br from-fuchsia-500 to-purple-500 rounded-full flex items-center justify-center shadow-2xl z-10">
          <Mic className="h-10 w-10 text-white" />
        </motion.div>
      </div>
    )
  },
];

export default function Landing() {
  const { currentUser, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [authMode, setAuthMode] = useState<string>("login");
  const [isAppLoading, setIsAppLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAppLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleLoginSuccess = () => setLocation("/dashboard");

  return (
    <>
      <AnimatePresence>
        {isAppLoading && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="relative flex items-center justify-center h-32 w-32 mb-8"
            >
              <div className="absolute inset-0 rounded-full border-t-2 border-indigo-500 blur-sm" />
              <div className="absolute inset-2 rounded-full border-r-2 border-cyan-400 blur-md" />
              <Sparkles className="h-10 w-10 text-indigo-500 dark:text-cyan-400 animate-pulse" />
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-400"
            >
              Initializing Core
            </motion.h1>
            <motion.div className="w-48 h-1 mt-6 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuroraUI>
        <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
          {!currentUser && (
            <Button
              variant="outline"
              className="glass-card bg-transparent hover:bg-slate-100/50 dark:hover:bg-slate-800/50 dark:text-white border-slate-200 dark:border-white/20 rounded-full px-6"
              onClick={() => document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Login
            </Button>
          )}
          <ThemeToggle />
        </div>

        {/* Global passive floating background elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <motion.div animate={{ y: [0, -40, 0], x: [0, 20, 0], scale: [1, 1.1, 1] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute left-[10%] top-[20%] w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] rounded-full blur-[120px] bg-indigo-500/20 mix-blend-screen" />
          <motion.div animate={{ y: [0, 50, 0], x: [0, -30, 0], scale: [1, 1.2, 1] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute right-[5%] bottom-[10%] w-[50vw] h-[50vw] max-w-[700px] max-h-[700px] rounded-full blur-[120px] bg-cyan-400/20 mix-blend-screen" />
        </div>

        <div className="relative z-10 flex flex-col items-center">
          
          {/* HERO SECTION */}
          <section className="min-h-screen w-full flex flex-col items-center justify-center pt-32 pb-0 px-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
            
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 2.2, ease: [0.22, 1, 0.36, 1] }} className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center">
              
              <h1 className="text-6xl md:text-8xl lg:text-9xl font-extrabold tracking-tight leading-none mb-6 mt-10">
                <span className="text-slate-900 dark:text-white drop-shadow-sm">Medi</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-400 drop-shadow-xl">AI</span>
              </h1>
              
              <p className="text-xl md:text-2xl lg:text-3xl max-w-3xl mx-auto font-light text-slate-600 dark:text-slate-300 tracking-tight leading-relaxed mb-12">
                <span className="font-medium text-slate-800 dark:text-slate-200">Your Intelligent Healthcare Companion.</span>
                <br />
                An immersive health platform that adapts to you.
              </p>

              {/* Floating Hero Mockup to fill blank space */}
              <motion.div 
                animate={{ y: [-10, 10, -10] }} 
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="w-full max-w-4xl mx-auto relative mt-4"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-cyan-400 blur-3xl opacity-20 dark:opacity-30 rounded-full" />
                <div className="glass-card rounded-t-3xl border-b-0 border border-white/20 dark:border-white/10 p-6 md:p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden h-[300px] md:h-[400px] [mask-image:linear-gradient(to_bottom,white,transparent)]">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  {/* Fake Chat Interface Mockup */}
                  <div className="flex w-full justify-end">
                    <div className="bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-2xl rounded-tr-sm h-12 w-2/3 shadow-md" />
                  </div>
                  <div className="flex w-full justify-start">
                    <div className="glass-card border border-white/10 rounded-2xl rounded-tl-sm h-24 w-3/4 shadow-sm backdrop-blur-md" />
                  </div>
                  <div className="flex w-full justify-end">
                     <div className="bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-2xl rounded-tr-sm h-16 w-1/2 shadow-md opacity-50" />
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </section>

          {/* INFINITE MARQUEE CAROUSEL */}
          <div className="w-full py-10 bg-slate-900/5 dark:bg-white/5 backdrop-blur-sm border-y border-white/10 overflow-hidden flex whitespace-nowrap">
            <motion.div 
              animate={{ x: [0, -1035] }} 
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="flex items-center gap-16 px-8"
            >
              {[...capabilities, ...capabilities, ...capabilities].map((cap, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="text-xl font-medium text-slate-800 dark:text-slate-200">{cap}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* DYNAMIC SCROLLING FEATURES */}
          <div className="w-full max-w-7xl mx-auto px-6 py-24">
            {features.map((feature, idx) => (
              <motion.section 
                key={feature.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ amount: 0.3, margin: "-50px" }}
                className={`min-h-[70vh] flex flex-col md:flex-row items-center gap-12 lg:gap-24 my-20 ${feature.align === 'right' ? 'md:flex-row-reverse' : ''}`}
              >
                {/* Text Content */}
                <div className={`flex-1 flex flex-col ${feature.align === 'right' ? 'md:items-end md:text-right' : 'md:items-start md:text-left'} text-center`}>
                  <motion.div
                    variants={{ hidden: { opacity: 0, scale: 0.5, rotate: -20 }, visible: { opacity: 1, scale: 1, rotate: 0 } }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="mb-8 relative self-center md:self-auto"
                  >
                    <div className={`absolute inset-0 blur-2xl opacity-40 bg-gradient-to-br ${feature.color}`} />
                    <feature.icon className={`h-20 w-20 md:h-24 md:w-24 text-transparent bg-clip-text bg-gradient-to-br ${feature.color} relative z-10 drop-shadow-2xl`} style={{ color: "transparent", fill: "url(#grad-icon)" }} />
                    <svg width="0" height="0">
                      <linearGradient id="grad-icon" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    </svg>
                  </motion.div>

                  <motion.h2
                    variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }}
                    transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                    className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter text-slate-900 dark:text-white leading-none mb-6 drop-shadow-md"
                  >
                    {feature.title}
                  </motion.h2>

                  <motion.p
                    variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="text-xl md:text-2xl font-light text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl"
                  >
                    {feature.desc}
                  </motion.p>
                </div>

                {/* Animated Mockup Card */}
                <motion.div 
                  variants={{ hidden: { opacity: 0, scale: 0.9, x: feature.align === 'right' ? -50 : 50 }, visible: { opacity: 1, scale: 1, x: 0 } }}
                  transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 w-full max-w-md aspect-square glass-card rounded-[2.5rem] border border-white/30 dark:border-white/10 shadow-2xl relative overflow-hidden group"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-5 group-hover:opacity-10 transition-opacity duration-700`} />
                  {feature.mockup}
                </motion.div>
              </motion.section>
            ))}
          </div>

          {/* STATS / TRUST SECTION */}
          <section className="w-full py-24 relative">
             <div className="absolute inset-0 bg-slate-900/5 dark:bg-white/5 backdrop-blur-md border-y border-white/10" />
             <div className="max-w-7xl mx-auto px-6 relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
               {[
                 { label: "Analyses Performed", value: "100k+", icon: Activity },
                 { label: "Data Security", value: "AEC-256", icon: Fingerprint },
                 { label: "Uptime", value: "99.9%", icon: Shield }
               ].map((stat, i) => (
                 <motion.div 
                   key={i}
                   initial={{ opacity: 0, y: 30 }}
                   whileInView={{ opacity: 1, y: 0 }}
                   viewport={{ once: true }}
                   transition={{ delay: i * 0.2, duration: 0.6 }}
                   className="flex flex-col items-center text-center p-8 glass-card rounded-3xl"
                 >
                   <stat.icon className="h-10 w-10 text-indigo-500 dark:text-cyan-400 mb-4" />
                   <h3 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-2">{stat.value}</h3>
                   <p className="text-slate-600 dark:text-slate-400 font-medium">{stat.label}</p>
                 </motion.div>
               ))}
             </div>
          </section>

          {/* AUTHENTICATION / TERMINAL SECTION */}
          <section id="auth-section" className="min-h-screen w-full flex items-center justify-center p-6 relative pb-32 pt-20">
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              className="w-full max-w-2xl relative z-20"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-cyan-500 to-purple-500 opacity-20 blur-[80px] rounded-full pointer-events-none" />
              
              <motion.div 
                variants={{ hidden: { opacity: 0, y: 50, scale: 0.95 }, visible: { opacity: 1, y: 0, scale: 1 } }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="glass-card rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-white/40 dark:border-white/10 relative overflow-hidden backdrop-blur-3xl"
              >
                <div className="text-center mb-10">
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-slate-900 dark:text-white mb-4">
                    {currentUser ? "Welcome back, Operator." : "Initiate Sequence."}
                  </h2>
                  <p className="text-lg text-slate-600 dark:text-slate-400 font-light">
                    {currentUser
                      ? "Your secure session is active. Enter the dashboard."
                      : "Create your secure identity to access the intelligence platform."}
                  </p>
                </div>

                {!isLoading && currentUser ? (
                  <div className="flex flex-col gap-4">
                    <Button
                      size="lg"
                      className="w-full text-lg h-14 bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all border-0 rounded-2xl"
                      onClick={() => setLocation("/dashboard")}
                    >
                      Enter Dashboard
                    </Button>
                    <Link href="/appointments">
                      <Button size="lg" variant="outline" className="w-full text-lg h-14 glass-card rounded-2xl hover:bg-white/50 dark:hover:bg-white/10 dark:text-white border border-slate-300 dark:border-white/20 shadow-sm transition-all hover:scale-[1.02]">
                        <CalendarCheck className="mr-2 h-5 w-5" />
                        Book Consultation
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Tabs value={authMode} onValueChange={setAuthMode} className="w-full">
                    <TabsList className="mb-8 grid w-full grid-cols-2 p-1 bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl h-14">
                      <TabsTrigger value="login" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-base transition-all">Login</TabsTrigger>
                      <TabsTrigger value="signup" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-base transition-all">Create Identity</TabsTrigger>
                    </TabsList>
                    <AnimatePresence mode="wait">
                      <motion.div key={authMode} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                        <TabsContent value="login" className="mt-0 outline-none">
                          <LoginForm onSuccess={handleLoginSuccess} />
                        </TabsContent>
                        <TabsContent value="signup" className="mt-0 outline-none">
                          <SignUpForm onSuccess={handleLoginSuccess} />
                        </TabsContent>
                      </motion.div>
                    </AnimatePresence>
                  </Tabs>
                )}
              </motion.div>
            </motion.div>
          </section>

        </div>
      </AuroraUI>
    </>
  );
}
