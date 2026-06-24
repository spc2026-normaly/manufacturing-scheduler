export interface TrainingStatus {
  state: "completed" | "warning_mid" | "warning_high" | "expired" | "none";
  date?: string;
  dday?: string;
}

export interface WorkerSafetyData {
  emp_name: string;
  login_id: string;
  trainings: [TrainingStatus, TrainingStatus, TrainingStatus, TrainingStatus, TrainingStatus];
}

export interface ApiEmployee {
  emp_id: string;
  login_id: string;
  emp_name: string;
  emp_role: string;
  emp_date: string;
}

export interface ApiSafetyTraining {
  training_id: string;
  emp_id: string;
  training_name: string;
  training_date: string;
  expired_date: string;
  training_status: string;
}
