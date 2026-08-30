export type VehicleVisitDetail = {
  id: string;
  arrivalAt: string;
  note: string | null;
  vehicle: {
    id: string;
    plate: string;
    brand: string | null;
    model: string | null;
  };
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    note: string | null;
  } | null;
};
