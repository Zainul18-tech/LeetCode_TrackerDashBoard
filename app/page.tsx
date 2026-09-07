import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-1 flex-col items-center justify-center px-6 text-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          alt="Dr. N.G.P. Institute of Technology Campus"
          fill
          className="object-cover"
          priority
          unoptimized
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/60" />
        {/* Subtle blue gradient overlay at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1261A0]/30 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/90">
          Dr.NGP Institute of Technology
        </p>
        
        <h1 className="mt-3 text-4xl font-semibold text-white transition-colors hover:text-[#EAF5FF]">
          LeetCode Tracker
        </h1>
        
        <p className="mt-3 max-w-md text-white/90 transition-all duration-300 hover:scale-[1.01]">
          One console for HOD, Teacher, Tutor, and Class Advisor to follow
          student problem-solving progress.
        </p>
        
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link
            href="/login"
            className="flex h-12 items-center justify-center rounded-full bg-[#1261A0] px-8 text-sm font-medium text-white transition-all duration-300 hover:bg-[#0B4778] hover:shadow-lg hover:shadow-[#1261A0]/30 hover:scale-105 active:scale-95"
          >
            Sign in
          </Link>
          
          <Link
            href="#"
            className="flex h-12 items-center justify-center rounded-full bg-white/10 px-8 text-sm font-medium text-white transition-all duration-300 hover:bg-white/20 hover:shadow-lg"
          >
            Learn More
          </Link>
        </div>

        {/* Department Credit */}
        <div className="mt-12 border-t border-white/10 pt-6">
          <p className="text-xs text-white/70">
            Developed by Department of Computer Science and Engineering - III Year
          </p>
        </div>
      </div>
    </main>
  );
}