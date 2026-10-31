import { DELETE as remove, PATCH as update } from "@/features/finance/server/term-handlers";
type Params = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Params) { return update(request, (await params).id); }
export async function DELETE(request: Request, { params }: Params) { return remove(request, (await params).id); }
