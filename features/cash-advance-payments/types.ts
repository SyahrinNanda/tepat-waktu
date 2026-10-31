export type CashAdvancePaymentRow = {
  id: string;
  employeeName: string;
  employeeCode: string;
  requestDate: string;
  amount: number;
  installmentAmount: number;
  tenorMonths: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: "Berjalan" | "Lunas";
};
