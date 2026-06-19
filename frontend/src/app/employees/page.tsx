"use client";

import TeamManagement from "../TeamManagement";
import { useToast } from "../AppLayout";

export default function EmployeesPage() {
  const showToast = useToast();

  return <TeamManagement onShowToast={showToast} />;
}
