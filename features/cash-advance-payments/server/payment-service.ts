import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cashAdvancePayments, cashAdvanceRequests, employees } from "@/db/schema";
import type { CashAdvancePaymentRow } from "@/features/cash-advance-payments/types";

export async function listCashAdvancePayments(companyId: string): Promise<CashAdvancePaymentRow[]> {
  const paidAmount = sql<number>`coalesce(sum(${cashAdvancePayments.amount}), 0)::int`;
  const rows = await db
    .select({
      id: cashAdvanceRequests.id,
      employeeName: employees.name,
      employeeCode: employees.employeeCode,
      requestDate: cashAdvanceRequests.requestDate,
      amount: cashAdvanceRequests.amount,
      installmentAmount: cashAdvanceRequests.installmentAmount,
      tenorMonths: cashAdvanceRequests.tenorMonths,
      paidAmount,
    })
    .from(cashAdvanceRequests)
    .innerJoin(employees, eq(cashAdvanceRequests.employeeId, employees.id))
    .leftJoin(
      cashAdvancePayments,
      and(
        eq(cashAdvancePayments.cashAdvanceRequestId, cashAdvanceRequests.id),
        eq(cashAdvancePayments.companyId, companyId),
      ),
    )
    .where(
      and(
        eq(cashAdvanceRequests.companyId, companyId),
        eq(cashAdvanceRequests.status, "approved"),
      ),
    )
    .groupBy(cashAdvanceRequests.id, employees.id)
    .orderBy(desc(cashAdvanceRequests.requestDate));

  return rows.map((row) => {
    const remainingAmount = Math.max(0, row.amount - row.paidAmount);
    const dueDate = new Date(`${row.requestDate}T00:00:00`);
    dueDate.setMonth(dueDate.getMonth() + row.tenorMonths);
    return {
      ...row,
      remainingAmount,
      dueDate: dueDate.toISOString().slice(0, 10),
      status: remainingAmount === 0 ? "Lunas" : "Berjalan",
    };
  });
}

export async function createCashAdvancePayment(
  companyId: string,
  userId: string,
  input: {
    cashAdvanceRequestId: string;
    paymentDate: string;
    amount: number;
    method: string;
    note?: string;
  },
) {
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select({ id: cashAdvanceRequests.id, amount: cashAdvanceRequests.amount })
      .from(cashAdvanceRequests)
      .where(
        and(
          eq(cashAdvanceRequests.id, input.cashAdvanceRequestId),
          eq(cashAdvanceRequests.companyId, companyId),
          eq(cashAdvanceRequests.status, "approved"),
        ),
      )
      .limit(1);

    if (!request) throw new Error("Kasbon aktif tidak ditemukan.");

    const [summary] = await tx
      .select({ paidAmount: sql<number>`coalesce(sum(${cashAdvancePayments.amount}), 0)::int` })
      .from(cashAdvancePayments)
      .where(
        and(
          eq(cashAdvancePayments.cashAdvanceRequestId, request.id),
          eq(cashAdvancePayments.companyId, companyId),
        ),
      );

    const remainingAmount = Math.max(0, request.amount - summary.paidAmount);
    if (remainingAmount === 0) throw new Error("Kasbon ini sudah lunas.");
    if (input.amount > remainingAmount) {
      throw new Error(`Nominal pembayaran melebihi sisa kasbon Rp ${new Intl.NumberFormat("id-ID").format(remainingAmount)}.`);
    }

    const [payment] = await tx
      .insert(cashAdvancePayments)
      .values({
        companyId,
        cashAdvanceRequestId: request.id,
        paymentDate: input.paymentDate,
        amount: input.amount,
        method: input.method,
        note: input.note || null,
        createdBy: userId,
      })
      .returning();

    return payment;
  });
}
