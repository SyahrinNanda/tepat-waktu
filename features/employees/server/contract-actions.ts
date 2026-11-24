"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyRole } from "@/lib/current-company";
import { deleteContractFor, extendContractFor, saveContractFor, type ContractInput, type ContractResult } from "./contract-service";

export type { ContractInput, ContractResult };

const managers = ["admin", "general_manager", "hrd"] as const;
const refresh = (employeeId: string) => { revalidatePath(`/dashboard/karyawan/${employeeId}`); revalidatePath("/dashboard/karyawan"); };

export async function saveContract(employeeId: string, contractId: string | null, input: ContractInput): Promise<ContractResult> {
  const context = await requireCompanyRole([...managers]);
  const result = await saveContractFor(context.companyId, employeeId, contractId, input);
  if (result.ok) refresh(employeeId);
  return result;
}

/** Perpanjang: adds months to the contract's duration (the end date moves forward). */
export async function extendContract(employeeId: string, contractId: string, addMonths: number): Promise<ContractResult> {
  const context = await requireCompanyRole([...managers]);
  const result = await extendContractFor(context.companyId, employeeId, contractId, addMonths);
  if (result.ok) refresh(employeeId);
  return result;
}

export async function deleteContract(employeeId: string, contractId: string): Promise<ContractResult> {
  const context = await requireCompanyRole([...managers]);
  const result = await deleteContractFor(context.companyId, employeeId, contractId);
  if (result.ok) refresh(employeeId);
  return result;
}
