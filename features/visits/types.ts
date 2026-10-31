export type VisitRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  locationId: string | null;
  outletName: string;
  visitDate: string;
  visitTime: string;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  status: string;
  attachmentCount: number;
};

export type VisitEmployeeOption = { id: string; name: string; employeeCode: string };
export type VisitLocationOption = { id: string; name: string; latitude: number; longitude: number };

export type VisitReportRow = {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  visitCount: number;
  completedCount: number;
  lastVisitDate: string | null;
  outlets: string[];
};
