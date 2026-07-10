export interface HealthData {
  status: string;
  timestamp: string;
  database: string;
  version: string;
}

export interface CalendarScheduleDto {
  id: string;
  facility: string;
  task_name: string;
  task_type: string;
  equipment: string;
  workers: string[];
  product: string;
  order_num: string;
  start_date: string;
  end_date: string;
}

export interface CalendarTask {
  id: string;
  facility: string;
  taskName: string;
  taskType: string;
  equipment: string;
  workers: string[];
  product: string;
  orderNum: string;
  startDate: Date;
  endDate: Date;
}

export type CalendarView = "week" | "month";
