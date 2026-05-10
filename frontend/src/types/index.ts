export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'hr' | 'employee';
  avatar?: string;
  createdAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'hr' | 'employee';
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface Employee {
  _id: string;
  employeeId: string;
  user: User;
  department: string;
  position: string;
  salary: number;
  joiningDate: string;
  status: 'active' | 'inactive';
  contactNumber?: string;
  address?: string;
}

export interface Attendance {
  _id: string;
  employee: Employee;
  date: string;
  checkIn?: string;
  checkOut?: string;
  totalHours?: number;
  status: 'present' | 'absent' | 'late' | 'half-day';
  lateMinutes?: number;
}

export interface Task {
  _id: string;
  title: string;
  description: string;
  assignedTo: Employee;
  assignedBy: User;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  deadline: string;
  completedAt?: string;
  remarks?: string;
  createdAt: string;
}

export interface Leave {
  _id: string;
  employee: Employee;
  leaveType: 'sick' | 'casual' | 'annual' | 'unpaid';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  appliedAt: string;
  reviewedBy?: User;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface Payroll {
  _id: string;
  employee: Employee;
  basicSalary: number;
  allowances: {
    houseRent: number;
    dearness: number;
    medical: number;
    travel: number;
    other: number;
  };
  bonus: number;
  overtimePay: number;
  deductions: {
    tax: number;
    providentFund: number;
    healthInsurance: number;
    loan: number;
    advance: number;
    other: number;
  };
  totalAllowances: number;
  totalDeductions: number;
  netSalary: number;
  paymentStatus: 'pending' | 'paid' | 'cancelled';
  paymentDate?: string;
  month: number;
  year: number;
}

export interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'task' | 'leave' | 'payroll' | 'attendance' | 'system';
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}

export interface ApiError {
  success: false;
  message: string;
  error?: string;
}