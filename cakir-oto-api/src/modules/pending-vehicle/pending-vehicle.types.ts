export type PendingVehicleDto = {
  id: string;
  plate: string;
  createdAt: string;
};

export type ConfirmPendingVehicleResult = {
  pendingVehicleId: string;
  visitId: string;
  vehicleId: string;
  plate: string;
  arrivalAt: string;
};
