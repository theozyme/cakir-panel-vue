import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/ses-sistemi")({
  component: () => <Outlet />,
});
