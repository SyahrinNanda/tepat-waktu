export type PayrollTermType = "compensation" | "deduction";

export type PayrollTermRow = {
  id: string;
  name: string;
  type: PayrollTermType;
  active: boolean;
};

export type PayrollStatus = "New" | "Pending" | "Done" | "Finish";
export type PayrollSalaryType = "Jam" | "Hari" | "Bulan";

export type PayrollEmployeeOption = {
  id: string;
  name: string;
  employeeCode: string;
  baseSalary?: number;
};

export type PayrollRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  month: number;
  year: number;
  salaryType: PayrollSalaryType | string;
  quantity: number;
  rate: number;
  compensationAmount: number;
  deductionAmount: number;
  totalAmount: number;
  status: PayrollStatus | string;
  slipAssetId: string | null;
  slipOriginalName?: string | null;
  createdAt: string;
  items?: PayrollItemRow[];
};

export type PayrollItemRow = {
  id: string;
  payrollId: string;
  category: "compensation" | "deduction";
  name: string;
  rate: number;
  quantity: number;
  salaryType: string;
  totalAmount: number;
};
