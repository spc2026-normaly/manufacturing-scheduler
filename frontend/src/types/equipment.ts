export interface Equipment {
  eq_id: string;
  eq_name: string;
  eq_count: number;
  available_eq_count: number;
  check_cycle: number;
  eq_status: string;
  check_date: string;
  recent_check_date: string;
  durability: number;
  rest_duration: number;
}

export interface UpcomingEquipment {
  eq_name: string;
  check_date: string;
  dday: string;
}
