"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const justRegistered = params.get("confirm") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError || !data.user) {
      setError(signInError?.message || "Invalid email or password.");
      setLoading(false);
      return;
    }

    setLoading(false);

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-[#F7FBFF]">
      {/* Left Side - Image and College Name */}
      <div className="relative hidden lg:block lg:w-1/2">
        <Image
          src="https://assets.findmycollege.com/FMC_IMAGES/28006/assets/Arts-college.jpg"
          alt="Dr. N.G.P. Institute of Technology Campus"
          fill
          className="object-cover"
          priority
          unoptimized
        />
        {/* Dark overlay at bottom only for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        
        {/* College Name Overlay */}
        <div className="absolute bottom-12 left-12 right-12">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-white/80">
            Dr. N.G.P. Institute of Technology
          </p>
          <h2 className="mt-2 text-3xl font-bold text-white">
            Department of Computer Science and Engineering
          </h2>
          <p className="mt-2 text-sm text-white/70">
            LeetCode Tracker · Problem Solving Platform
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex w-full items-center justify-center px-4 sm:px-6 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile Header */}
          <div className="lg:hidden">
            <div className="flex items-center justify-center mb-3">
              <Image
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR623gi8bVMsv1dquevb-UoEC55eGxSljENkMiDALBvlw&s=10"
                alt="Dr. N.G.P. Institute of Technology Logo"
                width={60}
                height={60}
                className="object-contain"
                unoptimized
              />
            </div>
            <p className="text-center font-mono text-xs uppercase tracking-[0.3em] text-[#1261A0]">
              DR.NGP INSTITUTE OF TECHNOLOGY
            </p>
            <h1 className="mt-3 text-center text-3xl font-bold text-[#102A43]">
              LeetCode Tracker
            </h1>
            <p className="mt-2 text-center text-base text-[#627D98]">
              Sign in to continue
            </p>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:block">
            <div className="flex items-center justify-center mb-3">
              <Image
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR623gi8bVMsv1dquevb-UoEC55eGxSljENkMiDALBvlw&s=10"
                alt="Dr. N.G.P. Institute of Technology Logo"
                width={80}
                height={80}
                className="object-contain"
                unoptimized
              />
            </div>
            <p className="text-center font-mono text-xs uppercase tracking-[0.3em] text-[#1261A0]">
              DR.NGP INSTITUTE OF TECHNOLOGY
            </p>
            <h1 className="mt-3 text-center text-4xl font-bold text-[#102A43]">
              LeetCode Tracker
            </h1>
            <p className="mt-2 text-center text-base text-[#627D98]">
              Sign in to continue
            </p>
          </div>

          {justRegistered && (
            <div className="mt-6 rounded-xl border border-green-600/40 bg-green-50 p-4 text-center text-sm text-green-700">
              Registration successful. Please sign in.
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#102A43]">
                Email Address
              </label>

              <input
                type="email"
                required
                value={email}
                placeholder="Enter your email"
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[#1261A0]/10 bg-white px-5 py-3.5 text-[#102A43] placeholder:text-[#627D98] outline-none transition focus:border-[#1261A0] focus:ring-2 focus:ring-[#1261A0]/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#102A43]">
                Password
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  placeholder="Enter your password"
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-[#1261A0]/10 bg-white px-5 py-3.5 pr-12 text-[#102A43] placeholder:text-[#627D98] outline-none transition focus:border-[#1261A0] focus:ring-2 focus:ring-[#1261A0]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#627D98] hover:text-[#1261A0] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-12 w-full rounded-full bg-[#1261A0] text-base font-semibold text-white transition duration-300 hover:bg-[#0B4778] hover:shadow-lg hover:shadow-[#1261A0]/20 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing In..." : "Login"}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-[#627D98]">
            © {new Date().getFullYear()} NGPiTECH · Department of CSE
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F7FBFF] text-[#102A43]">
          Loading...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}