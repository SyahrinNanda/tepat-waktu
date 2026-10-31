export const SELECTED_COMPANY_COOKIE = "tepatwaktu_superadmin_company";

export function selectedCompanyFromRequest(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const entry = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SELECTED_COMPANY_COOKIE}=`));
  if (!entry) return null;
  const value = decodeURIComponent(entry.slice(SELECTED_COMPANY_COOKIE.length + 1));
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
