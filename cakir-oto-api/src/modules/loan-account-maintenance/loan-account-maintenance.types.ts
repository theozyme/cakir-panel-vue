export type LoanAccountMaintenanceDto = {
  id: string;
  name: string;
  isActive: boolean;
};

export type LoanAccountMaintenanceUpdate = {
  name?: string;
  isActive?: boolean;
};
