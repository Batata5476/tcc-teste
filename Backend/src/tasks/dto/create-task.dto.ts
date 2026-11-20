export class CreateTaskDto {
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedToId: number;
  companyId: number;
  dueDate: Date;
}
