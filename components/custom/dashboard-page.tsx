'use client';

import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";
import { BookOpen, Brain, FileText, ArrowRight, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const { user, profile, loading, refreshProfile } = useAuth();

  useEffect(() => {
    // Refresh profile when component mounts if user is logged in
    if (user && !profile) {
      refreshProfile();
    }
  }, [user, profile, refreshProfile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  const featureCards = [
    {
      title: "Practice",
      description: "Practice with thousands of SAT questions. Choose specific topics, question types, or take full-length adaptive tests",
      icon: FileText,
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-50 to-cyan-50",
      href: "/practice",
      stats: "1000+ Questions",
    },
    {
      title: "Learning Hub",
      description: "Master SAT concepts with interactive lessons and study guides",
      icon: BookOpen,
      gradient: "from-purple-500 to-pink-500",
      bgGradient: "from-purple-50 to-pink-50",
      href: "/learning",
      stats: "500+ Lessons",
    },
    {
      title: "Vocabulary Flashcards",
      description: "Build your vocabulary with spaced repetition flashcards",
      icon: Brain,
      gradient: "from-orange-500 to-red-500",
      bgGradient: "from-orange-50 to-red-50",
      href: "/vocabulary",
      stats: "2000+ Words",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-6">
            <Link href="/" className="inline-flex items-center gap-3 hover:opacity-80 transition-opacity">
              <Image 
                src="/logo-grey.png" 
                alt="J-Run SAT" 
                width={200}
                height={53}
                className="h-14 w-auto"
              />
              <span className="text-4xl font-bold text-gray-900 pt-2">J-Run</span>
            </Link>
            <div className="mt-4 border-b border-gray-200"></div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">
            Hello{profile?.firstName ? `, ${profile.firstName}` : ''}! 👋
          </h1>
          <p className="text-gray-600 text-lg">
            Ready to ace your SAT? Choose where you&apos;d like to start.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {featureCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <Link
                key={index}
                href={card.href}
                className="group relative overflow-hidden rounded-2xl bg-white border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Background Gradient */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${card.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                />
                
                {/* Content */}
                <div className="relative p-6">
                  {/* Icon */}
                  <div className="mb-4">
                    <div
                      className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${card.gradient} text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-gray-900">
                    {card.title}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                    {card.description}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center justify-between">
                    {card.stats && (
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {card.stats}
                      </span>
                    )}
                    <div
                      className={`flex items-center text-sm font-semibold bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent group-hover:translate-x-1 transition-transform duration-300 ${card.stats ? '' : 'ml-auto'}`}
                    >
                      Start
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </div>
                </div>

                {/* Hover Effect Border */}
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none`}
                />
              </Link>
            );
          })}
        </div>

        {/* Quick Stats Section */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Your Progress</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">0</p>
              <p className="text-sm text-gray-600 mt-1">Practice Tests Completed</p>
            </div>
            <div className="p-4 bg-cyan-50 rounded-lg">
              <p className="text-2xl font-bold text-cyan-600">0</p>
              <p className="text-sm text-gray-600 mt-1">Questions Answered</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">0</p>
              <p className="text-sm text-gray-600 mt-1">Lessons Completed</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">0</p>
              <p className="text-sm text-gray-600 mt-1">Words Mastered</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
