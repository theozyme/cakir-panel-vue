export type PersonnelMaintenanceDto = {
  id: string;
  name: string;
  isActive: boolean;
};

export type PersonnelMaintenanceUpdate = {
  name?: string;
  isActive?: boolean;
};
