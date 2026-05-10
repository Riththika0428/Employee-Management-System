"use client";

import { motion } from "framer-motion";
import Button from "@/components/common/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/common/Card";
import { 
  Users, 
  Plus, 
  Search, 
  MoreVertical, 
  Mail, 
  Phone, 
  Briefcase,
  ChevronRight,
  Filter
} from "lucide-react";

const employees = [
  {
    id: "1",
    name: "John Doe",
    email: "john.doe@company.com",
    role: "Senior Developer",
    department: "Engineering",
    status: "Active",
    image: null,
  },
  {
    id: "2",
    name: "Sarah Smith",
    email: "sarah.smith@company.com",
    role: "Product Designer",
    department: "Design",
    status: "Active",
    image: null,
  },
  {
    id: "3",
    name: "Mike Johnson",
    email: "mike.j@company.com",
    role: "HR Manager",
    department: "People",
    status: "On Leave",
    image: null,
  },
];

export default function EmployeesPage() {
  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
          <p className="text-foreground/60">Manage your workforce, roles, and departments.</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Employee
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b border-border/50 bg-accent/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Filter by name, email, or department..."
                className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                Filter
              </Button>
              <Button variant="outline" size="sm">
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-accent/10 border-b border-border">
                  <th className="px-6 py-4 text-sm font-semibold">Employee</th>
                  <th className="px-6 py-4 text-sm font-semibold">Department</th>
                  <th className="px-6 py-4 text-sm font-semibold">Status</th>
                  <th className="px-6 py-4 text-sm font-semibold">Contact</th>
                  <th className="px-6 py-4 text-sm font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employees.map((employee, index) => (
                  <motion.tr
                    key={employee.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group hover:bg-accent/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {employee.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{employee.name}</p>
                          <p className="text-xs text-foreground/60">{employee.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-3.5 h-3.5 text-foreground/40" />
                        <span className="text-sm">{employee.department}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        employee.status === "Active" 
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                          : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                      }`}>
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-foreground/40 hover:text-primary transition-colors cursor-pointer" />
                        <Phone className="w-4 h-4 text-foreground/40 hover:text-primary transition-colors cursor-pointer" />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 text-foreground/40">
                        <Button variant="ghost" size="sm" className="p-2 h-auto opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="p-2 h-auto">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
