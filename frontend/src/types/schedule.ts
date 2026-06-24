export type TabType = "month" | "week" | "day";

export interface MonthWeek {
  label: string;
  range: string;
  monday: Date;
  sunday: Date;
}

export interface CalendarCell {
  date: Date;
  isCurrentMonth: boolean;
}

export interface ProductionTask {
  id: string;
  facility: string;
  taskName: string;
  taskType: string;
  equipment: string;
  workers: string[];
  product: string;
  orderNum: string;
  colorClass: string;
  startDate: Date;
  endDate: Date;
  startWeek: number; 
  endWeek: number;
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
