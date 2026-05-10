"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/common/Card";
import { 
  Users, 
  Calendar, 
  CheckCircle2, 
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { motion } from "framer-motion";

const stats = [
  {
    title: "Total Employees",
    value: "154",
    change: "+4.5%",
    trend: "up",
    icon: Users,
    color: "text-blue-500",
  },
  {
    title: "On Duty Today",
    value: "142",
    change: "92%",
    trend: "up",
    icon: Calendar,
    color: "text-emerald-500",
  },
  {
    title: "Tasks Completed",
    value: "89",
    change: "+12%",
    trend: "up",
    icon: CheckCircle2,
    color: "text-indigo-500",
  },
  {
    title: "Monthly Payroll",
    value: "$45,200",
    change: "-2.1%",
    trend: "down",
    icon: DollarSign,
    color: "text-amber-500",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 },
};

export default function DashboardPage() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-foreground/60">Welcome back, here's what's happening today.</p>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat, index) => (
          <motion.div key={index} variants={item}>
            <Card className="hover:scale-[1.02] transition-transform duration-300">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-foreground/60">
                  {stat.title}
                </CardTitle>
                <div className={`${stat.color} p-2 rounded-lg bg-current/10`}>
                  <stat.icon className="w-4 h-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center gap-1 mt-1">
                  {stat.trend === "up" ? (
                    <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 text-destructive" />
                  )}
                  <span className={stat.trend === "up" ? "text-emerald-500" : "text-destructive"}>
                    {stat.change}
                  </span>
                  <span className="text-xs text-foreground/40 ml-1">vs last month</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid gap-6 md:grid-cols-7">
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle>Company Performance</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center border-2 border-dashed border-border rounded-xl mx-6 mb-6">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 text-primary/20 mx-auto mb-2" />
              <p className="text-sm text-foreground/40 font-medium">Chart visualization will be implemented with Recharts</p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">John Doe <span className="text-foreground/60 font-normal">checked in</span></p>
                    <p className="text-xs text-foreground/40">2 hours ago</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

